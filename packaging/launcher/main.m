#import <Cocoa/Cocoa.h>
#include <sys/sysctl.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <signal.h>
#include <unistd.h>

static NSString *const kRosettaRuntime = @"/Library/Apple/usr/libexec/oah/libRosettaRuntime";
static NSString *const kRosettaCmd = @"softwareupdate --install-rosetta --agree-to-license";

static NSString *SliceArch(void) {
#if defined(__arm64__)
    return @"arm64";
#else
    return @"x86_64";
#endif
}

static BOOL MachineIsArm(void) {
    int v = 0; size_t n = sizeof(v);
    if (sysctlbyname("hw.optional.arm64", &v, &n, NULL, 0) != 0) return NO;
    return v == 1;
}

static BOOL IsTranslated(void) {
    int v = 0; size_t n = sizeof(v);
    if (sysctlbyname("sysctl.proc_translated", &v, &n, NULL, 0) != 0) return NO;
    return v == 1;
}

static BOOL RosettaInstalled(void) {
    return [[NSFileManager defaultManager] fileExistsAtPath:kRosettaRuntime];
}

static NSString *Home(void) {
    NSString *h = [[NSProcessInfo processInfo] environment][@"HOME"];
    return h.length ? h : NSHomeDirectory();
}

static NSData *HTTPGet(NSString *url, NSTimeInterval timeout) {
    NSURLSessionConfiguration *cfg = [NSURLSessionConfiguration ephemeralSessionConfiguration];
    cfg.timeoutIntervalForRequest = timeout;
    cfg.timeoutIntervalForResource = timeout;
    cfg.connectionProxyDictionary = @{};
    NSURLSession *s = [NSURLSession sessionWithConfiguration:cfg];
    __block NSData *out = nil;
    dispatch_semaphore_t sem = dispatch_semaphore_create(0);
    NSURLSessionDataTask *t = [s dataTaskWithURL:[NSURL URLWithString:url]
                               completionHandler:^(NSData *d, NSURLResponse *r, NSError *e) {
        if (!e && [(NSHTTPURLResponse *)r statusCode] == 200) out = d;
        dispatch_semaphore_signal(sem);
    }];
    [t resume];
    dispatch_semaphore_wait(sem, dispatch_time(DISPATCH_TIME_NOW, (int64_t)((timeout + 1) * NSEC_PER_SEC)));
    [s invalidateAndCancel];
    return out;
}

static NSDictionary *JSONGet(NSString *url, NSTimeInterval timeout) {
    NSData *d = HTTPGet(url, timeout);
    if (!d) return nil;
    id o = [NSJSONSerialization JSONObjectWithData:d options:0 error:nil];
    return [o isKindOfClass:[NSDictionary class]] ? o : nil;
}

static BOOL PingEELAB(NSString *base) {
    if (!base.length) return NO;
    if (![base hasSuffix:@"/"]) base = [base stringByAppendingString:@"/"];
    NSDictionary *j = JSONGet([base stringByAppendingString:@"api/ping"], 1.5);
    return [j[@"app"] isEqual:@"EELAB"];
}

static BOOL PortFree(int port) {
    int fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0) return NO;
    struct sockaddr_in a; memset(&a, 0, sizeof(a));
    a.sin_family = AF_INET; a.sin_port = htons(port); a.sin_addr.s_addr = inet_addr("127.0.0.1");
    BOOL ok = bind(fd, (struct sockaddr *)&a, sizeof(a)) == 0;
    close(fd);
    return ok;
}

@interface EELAB : NSObject <NSApplicationDelegate>
@property (strong) NSString *res, *appDir, *toolchain, *stateDir, *logPath;
@property (strong) NSArray<NSArray<NSString *> *> *candidates;
@property (strong) NSTask *task;
@property (strong) NSString *url;
@property (strong) NSString *pyUsed;
@property NSUInteger candidate;
@property BOOL quitting, ready;
@property NSTimeInterval startedAt;
@property (strong) NSArray *signalSources;
@end

@implementation EELAB

- (instancetype)init {
    if ((self = [super init])) {
        _res = [[NSBundle mainBundle] resourcePath];
        _appDir = [_res stringByAppendingPathComponent:@"app"];
        _toolchain = [_res stringByAppendingPathComponent:@"toolchain"];
        _stateDir = [Home() stringByAppendingPathComponent:@"Library/Application Support/EELAB"];
        _logPath = [Home() stringByAppendingPathComponent:@"Library/Logs/EELAB/server.log"];
        _candidates = [self pythonCandidates];
    }
    return self;
}

- (NSString *)pythonFor:(NSString *)arch {
    return [_res stringByAppendingPathComponent:[NSString stringWithFormat:@"python/%@/bin/python3", arch]];
}

- (NSArray<NSArray<NSString *> *> *)pythonCandidates {
    NSFileManager *fm = [NSFileManager defaultManager];
    NSMutableArray *c = [NSMutableArray array];
    NSString *mine = SliceArch();
    NSString *py = [self pythonFor:mine];
    if ([fm isExecutableFileAtPath:py]) [c addObject:@[mine, py]];
    if ([mine isEqual:@"arm64"]) {
        NSString *x = [self pythonFor:@"x86_64"];
        if ([fm isExecutableFileAtPath:x] && RosettaInstalled()) [c addObject:@[@"x86_64", x]];
    } else if (MachineIsArm() && IsTranslated()) {
        NSString *a = [self pythonFor:@"arm64"];
        if ([fm isExecutableFileAtPath:a]) [c addObject:@[@"arm64", a]];
    }
    return c;
}

- (NSDictionary *)serverEnv {
    NSDictionary *pe = [[NSProcessInfo processInfo] environment];
    NSMutableDictionary *e = [@{@"PATH": @"/usr/bin:/bin:/usr/sbin:/sbin", @"LANG": @"en_US.UTF-8",
                                @"LC_ALL": @"en_US.UTF-8", @"PYTHONIOENCODING": @"utf-8",
                                @"HOME": Home(), @"EELAB_APP": _appDir,
                                @"EELAB_TOOLCHAIN": _toolchain} mutableCopy];
    for (NSString *k in @[@"TMPDIR", @"USER", @"LOGNAME", @"EELAB_HOME", @"EELAB_MIGRATE_FROM"])
        if (pe[k]) e[k] = pe[k];
    return e;
}

- (void)log:(NSString *)line {
    NSFileHandle *h = [NSFileHandle fileHandleForWritingAtPath:_logPath];
    if (!h) return;
    [h seekToEndOfFile];
    NSString *s = [NSString stringWithFormat:@"[launcher %@] %@\n", [NSDate date], line];
    [h writeData:[s dataUsingEncoding:NSUTF8StringEncoding]];
    [h closeFile];
}

- (void)prepareLog {
    NSFileManager *fm = [NSFileManager defaultManager];
    [fm createDirectoryAtPath:[_logPath stringByDeletingLastPathComponent] withIntermediateDirectories:YES attributes:nil error:nil];
    NSDictionary *a = [fm attributesOfItemAtPath:_logPath error:nil];
    if (a && [a fileSize] > 1024 * 1024) {
        NSString *old = [_logPath stringByAppendingString:@".1"];
        [fm removeItemAtPath:old error:nil];
        [fm moveItemAtPath:_logPath toPath:old error:nil];
    }
    if (![fm fileExistsAtPath:_logPath]) [fm createFileAtPath:_logPath contents:nil attributes:nil];
}

- (NSString *)logTail:(NSUInteger)n {
    NSString *s = [NSString stringWithContentsOfFile:_logPath encoding:NSUTF8StringEncoding error:nil] ?: @"";
    NSArray *lines = [s componentsSeparatedByString:@"\n"];
    NSUInteger from = lines.count > n ? lines.count - n : 0;
    return [[lines subarrayWithRange:NSMakeRange(from, lines.count - from)] componentsJoinedByString:@"\n"];
}

- (NSDictionary *)serverJSON {
    NSData *d = [NSData dataWithContentsOfFile:[_stateDir stringByAppendingPathComponent:@"server.json"]];
    if (!d) return nil;
    id o = [NSJSONSerialization JSONObjectWithData:d options:0 error:nil];
    return [o isKindOfClass:[NSDictionary class]] ? o : nil;
}

- (NSString *)runningInstance {
    NSString *u = [self serverJSON][@"url"];
    if ([u isKindOfClass:[NSString class]] && PingEELAB(u)) return u;
    return nil;
}

- (int)pickPort {
    for (int p = 8321; p <= 8399; p++) if (PortFree(p)) return p;
    return 0;
}

- (void)openBrowser {
    if (!_url) return;
    if ([[[NSProcessInfo processInfo] environment][@"EELAB_NO_BROWSER"] isEqual:@"1"]) { [self log:[@"tarayıcı (atlandı): " stringByAppendingString:_url]]; return; }
    [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:_url]];
}

- (void)buildMenu {
    NSMenu *bar = [NSMenu new];
    NSMenuItem *appItem = [NSMenuItem new];
    [bar addItem:appItem];
    NSMenu *m = [[NSMenu alloc] initWithTitle:@"EELAB"];
    [m addItemWithTitle:@"Tarayıcıda Aç" action:@selector(openBrowserAction:) keyEquivalent:@"o"];
    [m addItemWithTitle:@"Çalışma Klasörünü Göster" action:@selector(showWorkspace:) keyEquivalent:@""];
    [m addItem:[NSMenuItem separatorItem]];
    [m addItemWithTitle:@"Tanılama" action:@selector(diagnostics:) keyEquivalent:@""];
    [m addItemWithTitle:@"Günlüğü Göster" action:@selector(showLog:) keyEquivalent:@""];
    [m addItem:[NSMenuItem separatorItem]];
    [m addItemWithTitle:@"EELAB'dan Çık" action:@selector(terminate:) keyEquivalent:@"q"];
    appItem.submenu = m;
    [NSApp setMainMenu:bar];
}

- (void)installSignalHandlers {
    NSMutableArray *srcs = [NSMutableArray array];
    for (NSNumber *sig in @[@(SIGTERM), @(SIGINT), @(SIGHUP)]) {
        signal(sig.intValue, SIG_IGN);
        dispatch_source_t s = dispatch_source_create(DISPATCH_SOURCE_TYPE_SIGNAL, sig.unsignedLongValue, 0, dispatch_get_main_queue());
        dispatch_source_set_event_handler(s, ^{ [NSApp terminate:nil]; });
        dispatch_resume(s);
        [srcs addObject:s];
    }
    _signalSources = srcs;
}

- (void)applicationDidFinishLaunching:(NSNotification *)n {
    [self installSignalHandlers];
    [self buildMenu];
    [self prepareLog];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSString *existing = [self runningInstance];
        dispatch_async(dispatch_get_main_queue(), ^{
            if (existing) {
                self.url = existing;
                [self log:[@"zaten çalışıyor: " stringByAppendingString:existing]];
                [self openBrowser];
                [NSApp terminate:nil];
                return;
            }
            [self startServer];
        });
    });
}

- (void)startServer {
    if (_candidate >= _candidates.count) {
        [self fail:@"Uygun Python bulunamadı ya da sunucu başlatılamadı." detail:[self logTail:20]];
        return;
    }
    NSArray *c = _candidates[_candidate];
    int port = [self pickPort];
    if (!port) { [self fail:@"8321–8399 arasında boş port yok." detail:@""]; return; }
    NSString *py = c[1];
    NSMutableArray *args = [@[@"-I", @"-B", [_appDir stringByAppendingPathComponent:@"server.py"],
                              @"--launcher", @"--no-open", @"--port", [NSString stringWithFormat:@"%d", port]] mutableCopy];
    NSTask *t = [NSTask new];
    if ([c[0] isEqual:@"x86_64"] && MachineIsArm() && !IsTranslated()) {
        t.executableURL = [NSURL fileURLWithPath:@"/usr/bin/arch"];
        [args insertObject:py atIndex:0];
        [args insertObject:@"-x86_64" atIndex:0];
    } else {
        t.executableURL = [NSURL fileURLWithPath:py];
    }
    t.arguments = args;
    t.environment = [self serverEnv];
    t.currentDirectoryURL = [NSURL fileURLWithPath:Home()];
    NSFileHandle *h = [NSFileHandle fileHandleForWritingAtPath:_logPath];
    [h seekToEndOfFile];
    t.standardOutput = h;
    t.standardError = h;
    t.standardInput = [NSFileHandle fileHandleWithNullDevice];
    __weak typeof(self) ws = self;
    t.terminationHandler = ^(NSTask *done) {
        dispatch_async(dispatch_get_main_queue(), ^{ [ws serverExited:done]; });
    };
    [self log:[NSString stringWithFormat:@"başlatılıyor: dilim=%@ çeviri=%d python=%@ port=%d", SliceArch(), IsTranslated(), c[0], port]];
    NSError *err = nil;
    _startedAt = [NSDate timeIntervalSinceReferenceDate];
    _ready = NO;
    _pyUsed = c[0];
    if (![t launchAndReturnError:&err]) {
        [self log:[@"başlatılamadı: " stringByAppendingString:err.localizedDescription ?: @"?"]];
        _candidate++;
        [self startServer];
        return;
    }
    _task = t;
    int pid = t.processIdentifier;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSString *found = nil;
        for (int i = 0; i < 150 && t.running; i++) {
            NSDictionary *sj = [ws serverJSON];
            NSString *u = sj[@"url"];
            if ([sj[@"pid"] intValue] == pid && [u isKindOfClass:[NSString class]] && PingEELAB(u)) { found = u; break; }
            usleep(200 * 1000);
        }
        dispatch_async(dispatch_get_main_queue(), ^{
            if (!found || ws.task != t) return;
            ws.url = found;
            ws.ready = YES;
            [ws log:[@"hazır: " stringByAppendingString:found]];
            [ws openBrowser];
            [ws checkToolchain];
        });
    });
}

- (void)checkToolchain {
    NSString *u = _url;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        NSDictionary *info = JSONGet([u stringByAppendingString:@"api/info"], 3);
        NSString *mode = [info[@"toolchain"] isKindOfClass:[NSDictionary class]] ? info[@"toolchain"][@"mode"] : nil;
        if (![mode isEqual:@"missing"] || !MachineIsArm() || RosettaInstalled()) return;
        dispatch_async(dispatch_get_main_queue(), ^{
            NSAlert *a = [NSAlert new];
            a.messageText = @"Derleyici çalıştırılamadı";
            a.informativeText = [NSString stringWithFormat:@"Bu Mac'te derleyici araçları için Rosetta 2 gerekebilir. Terminal'de şu komutu çalıştırıp EELAB'ı yeniden açın:\n\n%@", kRosettaCmd];
            [a addButtonWithTitle:@"Tamam"];
            [a addButtonWithTitle:@"Komutu Kopyala"];
            if ([a runModal] == NSAlertSecondButtonReturn) {
                [[NSPasteboard generalPasteboard] clearContents];
                [[NSPasteboard generalPasteboard] setString:kRosettaCmd forType:NSPasteboardTypeString];
            }
        });
    });
}

- (void)serverExited:(NSTask *)t {
    if (t != _task) return;
    _task = nil;
    if (_quitting) return;
    int code = t.terminationStatus;
    BOOL early = !_ready && ([NSDate timeIntervalSinceReferenceDate] - _startedAt) < 15;
    [self log:[NSString stringWithFormat:@"sunucu çıktı: kod=%d neden=%ld", code, (long)t.terminationReason]];
    if (early) {
        _candidate++;
        if (_candidate < _candidates.count) { [self startServer]; return; }
        [self fail:@"EELAB sunucusu başlatılamadı." detail:[self logTail:20]];
        return;
    }
    [NSApp terminate:nil];
}

- (void)fail:(NSString *)msg detail:(NSString *)detail {
    [self log:msg];
    [NSApp activateIgnoringOtherApps:YES];
    NSAlert *a = [NSAlert new];
    a.alertStyle = NSAlertStyleCritical;
    a.messageText = msg;
    a.informativeText = detail.length ? detail : @"Ayrıntı için ~/Library/Logs/EELAB/server.log dosyasına bakın.";
    [a addButtonWithTitle:@"Çık"];
    [a addButtonWithTitle:@"Günlüğü Göster"];
    if ([a runModal] == NSAlertSecondButtonReturn) [self showLog:nil];
    _quitting = YES;
    [NSApp terminate:nil];
}

- (void)openBrowserAction:(id)s { [self openBrowser]; }

- (void)showWorkspace:(id)s {
    NSString *u = _url;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSDictionary *info = u ? JSONGet([u stringByAppendingString:@"api/info"], 3) : nil;
        NSString *p = [info[@"workspace"] isKindOfClass:[NSString class]] ? info[@"workspace"] : nil;
        if (!p) p = [info[@"home"] isKindOfClass:[NSString class]] ? info[@"home"] : nil;
        if (!p) p = [Home() stringByAppendingPathComponent:@"Documents/EELAB"];
        dispatch_async(dispatch_get_main_queue(), ^{
            [[NSWorkspace sharedWorkspace] openURL:[NSURL fileURLWithPath:p isDirectory:YES]];
        });
    });
}

- (void)showLog:(id)s {
    [[NSWorkspace sharedWorkspace] activateFileViewerSelectingURLs:@[[NSURL fileURLWithPath:_logPath]]];
}

- (NSString *)runSelftest {
    NSArray *c = _candidates.count ? _candidates[MIN(_candidate, _candidates.count - 1)] : nil;
    if (!c) return @"python bulunamadı";
    NSTask *t = [NSTask new];
    NSMutableArray *args = [@[@"-I", @"-B", [_appDir stringByAppendingPathComponent:@"server.py"], @"--selftest"] mutableCopy];
    if ([c[0] isEqual:@"x86_64"] && MachineIsArm() && !IsTranslated()) {
        t.executableURL = [NSURL fileURLWithPath:@"/usr/bin/arch"];
        [args insertObject:c[1] atIndex:0];
        [args insertObject:@"-x86_64" atIndex:0];
    } else {
        t.executableURL = [NSURL fileURLWithPath:c[1]];
    }
    t.arguments = args;
    t.environment = [self serverEnv];
    NSPipe *p = [NSPipe pipe];
    t.standardOutput = p;
    t.standardError = p;
    NSError *e = nil;
    if (![t launchAndReturnError:&e]) return [@"çalıştırılamadı: " stringByAppendingString:e.localizedDescription ?: @"?"];
    NSData *d = [[p fileHandleForReading] readDataToEndOfFile];
    [t waitUntilExit];
    NSString *out = [[NSString alloc] initWithData:d encoding:NSUTF8StringEncoding] ?: @"";
    return [NSString stringWithFormat:@"çıkış kodu %d\n%@", t.terminationStatus, out];
}

- (void)diagnostics:(id)s {
    NSString *u = _url;
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSMutableString *r = [NSMutableString string];
        NSDictionary *bi = [[NSBundle mainBundle] infoDictionary];
        [r appendFormat:@"EELAB %@\n", bi[@"CFBundleShortVersionString"] ?: @"?"];
        [r appendFormat:@"macOS %@\n", [[NSProcessInfo processInfo] operatingSystemVersionString]];
        [r appendFormat:@"makine: %@, başlatıcı dilimi: %@%@\n", MachineIsArm() ? @"Apple Silicon (arm64)" : @"Intel (x86_64)",
            SliceArch(), IsTranslated() ? @" (Rosetta altında)" : @""];
        [r appendFormat:@"Rosetta 2: %@\n", RosettaInstalled() ? @"kurulu" : @"yok"];
        [r appendFormat:@"sunucu python: %@\n", self.pyUsed ?: @"-"];
        [r appendFormat:@"paket: %@\n\n", [[NSBundle mainBundle] bundlePath]];
        if (u) {
            NSData *info = HTTPGet([u stringByAppendingString:@"api/info"], 3);
            [r appendFormat:@"/api/info:\n%@\n\n", info ? [[NSString alloc] initWithData:info encoding:NSUTF8StringEncoding] : @"(yanıt yok)"];
        }
        [r appendFormat:@"öz-denetim (--selftest):\n%@", [self runSelftest]];
        dispatch_async(dispatch_get_main_queue(), ^{
            NSAlert *a = [NSAlert new];
            a.messageText = @"EELAB Tanılama";
            NSScrollView *sv = [[NSScrollView alloc] initWithFrame:NSMakeRect(0, 0, 560, 320)];
            sv.hasVerticalScroller = YES;
            NSTextView *tv = [[NSTextView alloc] initWithFrame:sv.bounds];
            tv.editable = NO;
            tv.font = [NSFont userFixedPitchFontOfSize:11];
            tv.string = r;
            sv.documentView = tv;
            a.accessoryView = sv;
            [a addButtonWithTitle:@"Tamam"];
            [a addButtonWithTitle:@"Panoya Kopyala"];
            [NSApp activateIgnoringOtherApps:YES];
            if ([a runModal] == NSAlertSecondButtonReturn) {
                [[NSPasteboard generalPasteboard] clearContents];
                [[NSPasteboard generalPasteboard] setString:r forType:NSPasteboardTypeString];
            }
        });
    });
}

- (BOOL)applicationShouldHandleReopen:(NSApplication *)app hasVisibleWindows:(BOOL)flag {
    [self openBrowser];
    return NO;
}

- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)app {
    _quitting = YES;
    NSTask *t = _task;
    if (t.running) {
        [t terminate];
        for (int i = 0; i < 30 && t.running; i++) usleep(100 * 1000);
        if (t.running) kill(t.processIdentifier, SIGKILL);
    }
    return NSTerminateNow;
}

- (void)printConfig {
    NSMutableArray *cs = [NSMutableArray array];
    for (NSArray *c in _candidates) [cs addObject:@{@"arch": c[0], @"python": c[1]}];
    NSDictionary *o = @{@"slice": SliceArch(), @"translated": @(IsTranslated()), @"machineArm64": @(MachineIsArm()),
                        @"resources": _res, @"app": _appDir, @"toolchain": _toolchain,
                        @"server": [_appDir stringByAppendingPathComponent:@"server.py"],
                        @"candidates": cs, @"env": [self serverEnv]};
    NSData *d = [NSJSONSerialization dataWithJSONObject:o options:NSJSONWritingPrettyPrinted | NSJSONWritingSortedKeys error:nil];
    fwrite(d.bytes, 1, d.length, stdout);
    fputc('\n', stdout);
}

@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc > 1 && strcmp(argv[1], "--print-config") == 0) {
            EELAB *d = [EELAB new];
            [d printConfig];
            return d.candidates.count ? 0 : 1;
        }
        NSApplication *app = [NSApplication sharedApplication];
        EELAB *d = [EELAB new];
        app.delegate = d;
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        [app run];
    }
    return 0;
}
