/* mikroC kutuphaneleri: yalnizca kullanilan bolumler derlenir (MC_USE_*) */
#if MC_FOSC <= 4000000UL
#define MC_MS_REP 1
#define MC_MS_LOOPS 0xF6
#elif MC_FOSC <= 8000000UL
#define MC_MS_REP 2
#define MC_MS_LOOPS 0xF7
#else
#define MC_MS_REP 5
#define MC_MS_LOOPS 0xF8
#endif

#ifdef MC_USE_DELAY_MS
static unsigned char mc_dc;
#if MC_MS_REP > 1
static unsigned char mc_dr;
#endif
void mc_delay_ms(unsigned int n) {
    while (n) {
        n--;
        __asm
            BANKSEL _mc_dc
#if MC_MS_REP > 1
            movlw   MC_MS_REP
            movwf   _mc_dr
        mc_dlo:
#endif
            movlw   MC_MS_LOOPS
            movwf   _mc_dc
        mc_dlp:
            nop
            decfsz  _mc_dc, f
            goto    mc_dlp
#if MC_MS_REP > 1
            decfsz  _mc_dr, f
            goto    mc_dlo
#endif
        __endasm;
    }
}
#endif

#ifdef MC_USE_DELAY_K
static volatile unsigned int mc_dk;
void mc_delay_k(unsigned int k) {
    mc_dk = k;
    __asm
        BANKSEL _mc_dk
    mc_dkl:
        movf    _mc_dk, w
        iorwf   (_mc_dk + 1), w
        btfsc   0x03, 2
        goto    mc_dke
        movlw   1
        subwf   _mc_dk, f
        btfss   0x03, 0
        decf    (_mc_dk + 1), f
        goto    mc_dkl
    mc_dke:
    __endasm;
}
#endif

#ifdef MC_USE_BUTTON
unsigned char Button(unsigned char *port, unsigned char pin, unsigned char time, unsigned char active_state) {
    unsigned char m = 1;
    while (pin--) m <<= 1;
    if (((*port & m) != 0) != (active_state != 0)) return 0;
    mc_delay_ms(time);
    if (((*port & m) != 0) != (active_state != 0)) return 0;
    return 255;
}
#endif

#if defined(MC_USE_LCD_CORE) && defined(MC_EXACT)
static void mc_lcd_nib(unsigned char v) {
    LCD_D4 = v & 1;
    LCD_D5 = (v >> 1) & 1;
    LCD_D6 = (v >> 2) & 1;
    LCD_D7 = (v >> 3) & 1;
    LCD_EN = 1;
    MC_XD_1US();
    LCD_EN = 0;
}
static void mc_lcd_wr(unsigned char v, unsigned char rs) {
    LCD_RS = rs;
    mc_lcd_nib(v >> 4);
    mc_lcd_nib(v);
    if (rs) MC_XD_50US();
    else MC_XD_5500US();
}
#elif defined(MC_USE_LCD_CORE)
static void mc_lcd_nib(unsigned char v) {
    LCD_D4 = v & 1;
    LCD_D5 = (v >> 1) & 1;
    LCD_D6 = (v >> 2) & 1;
    LCD_D7 = (v >> 3) & 1;
    LCD_EN = 1;
    __asm
        nop
        nop
    __endasm;
    LCD_EN = 0;
}
static void mc_lcd_wr(unsigned char v, unsigned char rs) {
    LCD_RS = rs;
    mc_lcd_nib(v >> 4);
    mc_lcd_nib(v);
    mc_delay_k(MC_US_K(50));
}
#endif

#if defined(MC_USE_Lcd_Init) && defined(MC_EXACT)
void Lcd_Init(void) {
    LCD_RS_Direction = 0;
    LCD_EN_Direction = 0;
    LCD_D4_Direction = 0;
    LCD_D5_Direction = 0;
    LCD_D6_Direction = 0;
    LCD_D7_Direction = 0;
    LCD_RS = 0;
    LCD_EN = 0;
    LCD_D4 = 0;
    LCD_D5 = 0;
    LCD_D6 = 0;
    LCD_D7 = 0;
    MC_XD_5500US();
    MC_XD_5500US();
    MC_XD_5500US();
    mc_lcd_nib(3);
    MC_XD_5500US();
    mc_lcd_nib(3);
    MC_XD_5500US();
    mc_lcd_nib(3);
    MC_XD_5500US();
    mc_lcd_nib(2);
    MC_XD_5500US();
    mc_lcd_wr(0x28, 0);
    mc_lcd_wr(0x08, 0);
    mc_lcd_wr(0x01, 0);
    mc_lcd_wr(0x06, 0);
    mc_lcd_wr(0x0F, 0);
}
#elif defined(MC_USE_Lcd_Init)
void Lcd_Init(void) {
    LCD_RS_Direction = 0;
    LCD_EN_Direction = 0;
    LCD_D4_Direction = 0;
    LCD_D5_Direction = 0;
    LCD_D6_Direction = 0;
    LCD_D7_Direction = 0;
    LCD_RS = 0;
    LCD_EN = 0;
    mc_delay_ms(20);
    mc_lcd_nib(3);
    mc_delay_ms(5);
    mc_lcd_nib(3);
    mc_delay_ms(1);
    mc_lcd_nib(3);
    mc_delay_ms(1);
    mc_lcd_nib(2);
    mc_delay_ms(1);
    mc_lcd_wr(0x28, 0);
    mc_lcd_wr(0x08, 0);
    mc_lcd_wr(0x01, 0);
    mc_delay_ms(2);
    mc_lcd_wr(0x06, 0);
    mc_lcd_wr(0x0F, 0);
}
#endif

#ifdef MC_USE_Lcd_Cmd
void Lcd_Cmd(unsigned char out_char) {
    mc_lcd_wr(out_char, 0);
#ifndef MC_EXACT
    if (out_char < 4) mc_delay_ms(2);
#endif
}
#endif

#ifdef MC_USE_Lcd_Chr_Cp
void Lcd_Chr_Cp(unsigned char out_char) {
    mc_lcd_wr(out_char, 1);
}
#endif

#ifdef MC_USE_LCD_GOTO
static void mc_lcd_goto(unsigned char row, unsigned char column) {
    unsigned char a = 0x80;
    if (row == 2) a = 0xC0;
    else if (row == 3) a = 0x94;
    else if (row == 4) a = 0xD4;
    mc_lcd_wr(a + column - 1, 0);
}
#endif

#ifdef MC_USE_Lcd_Chr
void Lcd_Chr(unsigned char row, unsigned char column, unsigned char out_char) {
    mc_lcd_goto(row, column);
    mc_lcd_wr(out_char, 1);
}
#endif

#ifdef MC_USE_Lcd_Out_Cp
void Lcd_Out_Cp(char *text) {
    while (*text) mc_lcd_wr(*text++, 1);
}
#endif

#ifdef MC_USE_Lcd_Out
void Lcd_Out(unsigned char row, unsigned char column, char *text) {
    mc_lcd_goto(row, column);
    while (*text) mc_lcd_wr(*text++, 1);
}
#endif

#ifdef MC_USE_Keypad_Init
void Keypad_Init(void) {
    MC_KP_TRIS = 0x0F;
    keypadPort = 0;
}
#endif

#ifdef MC_USE_Keypad_Key_Press
unsigned char Keypad_Key_Press(void) {
    unsigned char r, v, k, m;
    MC_KP_TRIS = 0x0F;
    m = 0x10;
    for (r = 1; r < 17; r += 4) {
        keypadPort = m;
        mc_delay_k(MC_US_K(5));
        v = keypadPort & 0x0F;
        if (v) {
            k = r;
            while (!(v & 1)) { v >>= 1; k++; }
            keypadPort = 0;
            return k;
        }
        m <<= 1;
    }
    keypadPort = 0;
    return 0;
}
#endif

#ifdef MC_USE_Keypad_Key_Click
unsigned char Keypad_Key_Click(void) {
    unsigned char k;
    do { k = Keypad_Key_Press(); } while (!k);
    mc_delay_ms(10);
    while (Keypad_Key_Press()) ;
    mc_delay_ms(10);
    return k;
}
#endif

#ifdef MC_USE_UART_INIT
void mc_uart_init(unsigned char spbrg, unsigned char brgh) {
    TRISB |= 0x06;
    SPBRG = spbrg;
    TXSTA = brgh ? 0x24 : 0x20;
    RCSTA = 0x90;
}
#endif

#ifdef MC_USE_UART1_Write
void UART1_Write(unsigned char data_) {
    while (!PIR1bits.TXIF) ;
    TXREG = data_;
}
#endif

#ifdef MC_USE_UART1_Read
unsigned char UART1_Read(void) {
    unsigned char d = RCREG;
    if (RCSTAbits.OERR) {
        RCSTAbits.CREN = 0;
        RCSTAbits.CREN = 1;
    }
    return d;
}
#endif

#ifdef MC_USE_UART1_Data_Ready
unsigned char UART1_Data_Ready(void) {
    if (RCSTAbits.OERR) {
        RCSTAbits.CREN = 0;
        RCSTAbits.CREN = 1;
    }
    return PIR1bits.RCIF;
}
#endif

#ifdef MC_USE_UART1_Tx_Idle
unsigned char UART1_Tx_Idle(void) {
    return TXSTAbits.TRMT;
}
#endif

#ifdef MC_USE_UART1_Write_Text
void UART1_Write_Text(char *uart_text) {
    while (*uart_text) UART1_Write(*uart_text++);
}
#endif

#ifdef MC_USE_UART1_Read_Text
void UART1_Read_Text(char *output, char *delimiter, unsigned char attempts) {
    unsigned char i = 0, m = 0, c;
    while (1) {
        while (!PIR1bits.RCIF) ;
        c = UART1_Read();
        output[i++] = c;
        if (c == delimiter[m]) {
            m++;
            if (!delimiter[m]) { output[i - m] = 0; return; }
        } else m = (c == delimiter[0]) ? 1 : 0;
        if (attempts != 255 && i >= attempts) { output[i] = 0; return; }
    }
}
#endif

#ifdef MC_USE_PWM_INIT
void mc_pwm_init(unsigned char pr2, unsigned char ck) {
    CCP1CON = 0;
    CCPR1L = 0;
    TMR2 = 0;
    PR2 = pr2;
    T2CON = ck;
}
#endif

#ifdef MC_USE_PWM1_Set_Duty
void PWM1_Set_Duty(unsigned char duty_ratio) {
    unsigned int dc = ((unsigned int)PR2 + 1) * duty_ratio;
    dc >>= 6;
    CCPR1L = dc >> 2;
    CCP1CON = (CCP1CON & 0xCF) | ((unsigned char)(dc & 3) << 4);
}
#endif

#ifdef MC_USE_PWM1_Start
void PWM1_Start(void) {
    TRISBbits.TRISB3 = 0;
    T2CONbits.TMR2ON = 1;
    CCP1CON |= 0x0C;
}
#endif

#ifdef MC_USE_PWM1_Stop
void PWM1_Stop(void) {
    CCP1CON &= 0xF0;
}
#endif

#ifdef MC_USE_EEPROM_Read
unsigned char EEPROM_Read(unsigned char address) {
    while (EECON1bits.WR) ;
    EEADR = address;
    EECON1bits.RD = 1;
    return EEDATA;
}
#endif

#ifdef MC_USE_EEPROM_Write
void EEPROM_Write(unsigned char address, unsigned char data_) {
    unsigned char g;
    while (EECON1bits.WR) ;
    EEADR = address;
    EEDATA = data_;
    EECON1bits.WREN = 1;
    g = INTCONbits.GIE;
    INTCONbits.GIE = 0;
    EECON2 = 0x55;
    EECON2 = 0xAA;
    EECON1bits.WR = 1;
    if (g) INTCONbits.GIE = 1;
    EECON1bits.WREN = 0;
}
#endif

#ifdef MC_USE_U2S
static void mc_u2s(unsigned int v, char *o, unsigned char w, unsigned char neg) {
    unsigned char i = w;
    o[w] = 0;
    do {
        o[--i] = '0' + (unsigned char)(v % 10);
        v /= 10;
    } while (v && i);
    if (neg && i) o[--i] = '-';
    while (i) o[--i] = ' ';
}
#endif

#ifdef MC_USE_ByteToStr
void ByteToStr(unsigned char input, char *output) {
    mc_u2s(input, output, 3, 0);
}
#endif

#ifdef MC_USE_ShortToStr
void ShortToStr(signed char input, char *output) {
    if (input < 0) mc_u2s((unsigned char)(-input), output, 4, 1);
    else mc_u2s((unsigned char)input, output, 4, 0);
}
#endif

#ifdef MC_USE_WordToStr
void WordToStr(unsigned int input, char *output) {
    mc_u2s(input, output, 5, 0);
}
#endif

#ifdef MC_USE_IntToStr
void IntToStr(int input, char *output) {
    if (input < 0) mc_u2s((unsigned int)(-input), output, 6, 1);
    else mc_u2s((unsigned int)input, output, 6, 0);
}
#endif

#ifdef MC_USE_L2S
static void mc_l2s(unsigned long v, char *o, unsigned char w, unsigned char neg) {
    unsigned char i = w;
    o[w] = 0;
    do {
        o[--i] = '0' + (unsigned char)(v % 10UL);
        v /= 10UL;
    } while (v && i);
    if (neg && i) o[--i] = '-';
    while (i) o[--i] = ' ';
}
#endif

#ifdef MC_USE_LongToStr
void LongToStr(long input, char *output) {
    if (input < 0) mc_l2s((unsigned long)(-input), output, 11, 1);
    else mc_l2s((unsigned long)input, output, 11, 0);
}
#endif

#ifdef MC_USE_LongWordToStr
void LongWordToStr(unsigned long input, char *output) {
    mc_l2s(input, output, 10, 0);
}
#endif

#ifdef MC_USE_HEX
static void mc_hex(unsigned int v, char *o, unsigned char n) {
    unsigned char d;
    o[n] = 0;
    while (n) {
        d = (unsigned char)v & 0x0F;
        o[--n] = d < 10 ? '0' + d : 'A' - 10 + d;
        v >>= 4;
    }
}
#endif

#ifdef MC_USE_ByteToHex
void ByteToHex(unsigned char input, char *output) {
    mc_hex(input, output, 2);
}
#endif

#ifdef MC_USE_ShortToHex
void ShortToHex(signed char input, char *output) {
    mc_hex((unsigned char)input, output, 2);
}
#endif

#ifdef MC_USE_WordToHex
void WordToHex(unsigned int input, char *output) {
    mc_hex(input, output, 4);
}
#endif

#ifdef MC_USE_IntToHex
void IntToHex(int input, char *output) {
    mc_hex((unsigned int)input, output, 4);
}
#endif

#ifdef MC_USE_U2Z
static void mc_u2z(unsigned int v, char *o, unsigned char w, unsigned char neg) {
    unsigned char i = w;
    o[w] = 0;
    while (i) {
        o[--i] = '0' + (unsigned char)(v % 10);
        v /= 10;
    }
    if (neg) o[0] = '-';
}
#endif

#ifdef MC_USE_ByteToStrWithZeros
void ByteToStrWithZeros(unsigned char input, char *output) {
    mc_u2z(input, output, 3, 0);
}
#endif

#ifdef MC_USE_ShortToStrWithZeros
void ShortToStrWithZeros(signed char input, char *output) {
    if (input < 0) mc_u2z((unsigned char)(-input), output, 4, 1);
    else mc_u2z((unsigned char)input, output, 4, 0);
}
#endif

#ifdef MC_USE_WordToStrWithZeros
void WordToStrWithZeros(unsigned int input, char *output) {
    mc_u2z(input, output, 5, 0);
}
#endif

#ifdef MC_USE_IntToStrWithZeros
void IntToStrWithZeros(int input, char *output) {
    if (input < 0) mc_u2z((unsigned int)(-input), output, 6, 1);
    else mc_u2z((unsigned int)input, output, 6, 0);
}
#endif

#ifdef MC_USE_Bcd2Dec
unsigned char Bcd2Dec(unsigned char bcdnum) {
    return (bcdnum >> 4) * 10 + (bcdnum & 0x0F);
}
#endif

#ifdef MC_USE_Dec2Bcd
unsigned char Dec2Bcd(unsigned char decnum) {
    return ((decnum / 10) << 4) | (decnum % 10);
}
#endif

#ifdef MC_USE_SOUND
static unsigned char *mc_snd_port;
static unsigned char mc_snd_mask;
#ifdef MC_USE_Sound_Init
void Sound_Init(unsigned char *snd_port, unsigned char snd_pin) {
    unsigned char m = 1;
    while (snd_pin--) m <<= 1;
    mc_snd_port = snd_port;
    mc_snd_mask = m;
    *(snd_port + 0x80) &= ~m;
    *snd_port &= ~m;
}
#endif
#ifdef MC_USE_Sound_Play
void Sound_Play(unsigned int freq_in_hz, unsigned int duration_ms) {
    unsigned long n;
    unsigned int k, half;
    if (!freq_in_hz) return;
    half = (unsigned int)((MC_FOSC / 8UL) / freq_in_hz);
    k = half > MC_US_A + 30 ? (half - MC_US_A - 30) / MC_US_B : 0;
    n = ((unsigned long)duration_ms * freq_in_hz) / 500UL;
    while (n) {
        *mc_snd_port ^= mc_snd_mask;
        mc_delay_k(k);
        n--;
    }
    *mc_snd_port &= ~mc_snd_mask;
}
#endif
#endif
