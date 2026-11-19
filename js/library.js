(function (root) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = { body: '#c8c8aa', edge: '#800000', wire: '#004000', bg: '#e0e0d0', paper: '#e0e0d0', grid: '#bdbdaf', sheet: '#0000c0', text: '#000000', lo: '#4040ff', hi: '#ff4040', z: '#808080', on: '#ff2a1a', off: '#521010' };
  const LEDC = { 'LED-RED': ['#ff2a1a', '#5a1414'], 'LED-GREEN': ['#2ee82e', '#14451a'], 'LED-YELLOW': ['#ffe11a', '#5a5014'], 'LED-BLUE': ['#3a7bff', '#142a5a'] };
  const P = (num, name, x, y) => ({ num: String(num), name, x, y });
  const SEGP = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP'];
  const DEC = [P(7, 'A', -10, 10), P(1, 'B', -10, 20), P(2, 'C', -10, 30), P(6, 'D', -10, 40), P(4, 'BI/RBO', -10, 70), P(5, 'RBI', -10, 80), P(3, 'LT', -10, 90),
    P(13, 'QA', 90, 10), P(12, 'QB', 90, 20), P(11, 'QC', 90, 30), P(10, 'QD', 90, 40), P(9, 'QE', 90, 50), P(15, 'QF', 90, 60), P(14, 'QG', 90, 70)];
  const two = (x1, x2, y) => [P(1, '1', x1, y), P(2, '2', x2, y)];
  const KP_PHONE = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['*', '0', '#']];
  const KP_CALC = [['7', '8', '9', '/'], ['4', '5', '6', 'x'], ['1', '2', '3', '-'], ['C', '0', '=', '+']];
  const kpPins = (rows, cols, h) => ['A', 'B', 'C', 'D'].slice(0, rows).map((r, i) => P(r, r, -10, 20 + 30 * i)).concat(Array.from({ length: cols }, (_, i) => P(i + 1, String(i + 1), 20 + 30 * i, h + 10)));
  const types = {
    'PIC16F628A': { prefix: 'U', label: 'PIC16F628A', w: 160, h: 200, defaultValue: '', pins: [
      P(17, 'RA0/AN0', 170, 20), P(18, 'RA1/AN1', 170, 30), P(1, 'RA2/AN2/VREF', 170, 40), P(2, 'RA3/AN3/CMP1', 170, 50), P(3, 'RA4/T0CKI/CMP2', 170, 60),
      P(6, 'RB0/INT', 170, 100), P(7, 'RB1/RX/DT', 170, 110), P(8, 'RB2/TX/CK', 170, 120), P(9, 'RB3/CCP1', 170, 130),
      P(10, 'RB4', 170, 140), P(11, 'RB5', 170, 150), P(12, 'RB6/T1OSO/T1CKI', 170, 160), P(13, 'RB7/T1OSI', 170, 170),
      P(16, 'RA7/OSC1/CLKIN', -10, 20), P(15, 'RA6/OSC2/CLKOUT', -10, 30), P(4, 'RA5/MCLR', -10, 60)] },
    '7448': { prefix: 'U', label: '7448', w: 80, h: 120, defaultValue: '', pins: DEC },
    '7447': { prefix: 'U', label: '7447', w: 80, h: 120, defaultValue: '', pins: DEC },
    '7SEG-MPX1-CC': { prefix: 'DS', label: '7SEG-MPX1-CC', w: 100, h: 120, defaultValue: '', pins: SEGP.map((s, i) => P(s, s, 10 + 10 * i, 130)).concat(P('K', 'K', 90, 130)) },
    '7SEG-MPX1-CA': { prefix: 'DS', label: '7SEG-MPX1-CA', w: 100, h: 120, defaultValue: '', pins: SEGP.map((s, i) => P(s, s, 10 + 10 * i, 130)).concat(P('COM', 'COM', 90, 130)) },
    '7SEG-MPX4-CC': { prefix: 'DS', label: '7SEG-MPX4-CC', w: 200, h: 100, defaultValue: '', pins: SEGP.map((s, i) => P(s, s, 10 + 10 * i, 110)).concat([1, 2, 3, 4].map(d => P(d, String(d), 110 + 10 * d, 110))) },
    '7SEG-MPX4-CA': { prefix: 'DS', label: '7SEG-MPX4-CA', w: 200, h: 100, defaultValue: '', pins: SEGP.map((s, i) => P(s, s, 10 + 10 * i, 110)).concat([1, 2, 3, 4].map(d => P(d, String(d), 110 + 10 * d, 110))) },
    '7SEG-BCD': { prefix: 'DS', label: '7SEG-BCD', w: 50, h: 70, defaultValue: '', pins: [1, 2, 4, 8].map((b, i) => P(b, String(b), 10 + 10 * i, 80)) },
    'LED-RED': { prefix: 'D', label: 'LED-RED', w: 40, h: 20, defaultValue: '', pins: [P('A', 'A', -10, 10), P('K', 'K', 50, 10)] },
    'LED-GREEN': { prefix: 'D', label: 'LED-GREEN', w: 40, h: 20, defaultValue: '', pins: [P('A', 'A', -10, 10), P('K', 'K', 50, 10)] },
    'LED-YELLOW': { prefix: 'D', label: 'LED-YELLOW', w: 40, h: 20, defaultValue: '', pins: [P('A', 'A', -10, 10), P('K', 'K', 50, 10)] },
    'LED-BLUE': { prefix: 'D', label: 'LED-BLUE', w: 40, h: 20, defaultValue: '', pins: [P('A', 'A', -10, 10), P('K', 'K', 50, 10)] },
    'LED-BARGRAPH-RED': { prefix: 'BAR', label: 'LED-BARGRAPH-RED', w: 50, h: 110, defaultValue: '', pins:
      Array.from({ length: 10 }, (_, i) => P('A' + (i + 1), 'A' + (i + 1), -10, 10 + 10 * i)).concat(Array.from({ length: 10 }, (_, i) => P('K' + (i + 1), 'K' + (i + 1), 60, 10 + 10 * i))) },
    'LM016L': { prefix: 'LCD', label: 'LM016L', w: 240, h: 120, defaultValue: '', pins:
      ['VSS', 'VDD', 'VEE', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'].map((n, i) => P(i + 1, n, 50 + 10 * i, 130)) },
    'BUTTON': { prefix: 'SW', label: 'BUTTON', w: 40, h: 20, defaultValue: '', pins: two(-10, 50, 10) },
    'SWITCH': { prefix: 'SW', label: 'SWITCH', w: 40, h: 20, defaultValue: '', pins: two(-10, 50, 10) },
    'DIPSW_8': { prefix: 'DSW', label: 'DIPSW_8', w: 50, h: 90, defaultValue: '', pins:
      Array.from({ length: 8 }, (_, i) => P(i + 1, String(i + 1), -10, 10 + 10 * i)).concat(Array.from({ length: 8 }, (_, i) => P(i + 9, String(i + 9), 60, 10 + 10 * i))) },
    'KEYPAD-PHONETYPE': { prefix: 'KP', label: 'KEYPAD-PHONETYPE', w: 100, h: 140, defaultValue: '', pins: kpPins(4, 3, 140), keys: KP_PHONE },
    'KEYPAD-SMALLCALC': { prefix: 'KP', label: 'KEYPAD-SMALLCALC', w: 130, h: 130, defaultValue: '', pins: kpPins(4, 4, 130), keys: KP_CALC },
    'LOGICSTATE': { prefix: 'L', label: 'LOGICSTATE', w: 20, h: 20, defaultValue: '0', pins: [P(1, '1', 30, 10)] },
    'RES': { prefix: 'R', label: 'RES', w: 40, h: 20, defaultValue: '10k', pins: two(-10, 50, 10) },
    'CAP': { prefix: 'C', label: 'CAP', w: 20, h: 20, defaultValue: '22p', pins: two(-10, 30, 10) },
    'CAP-ELEC': { prefix: 'C', label: 'CAP-ELEC', w: 20, h: 20, defaultValue: '10u', pins: two(-10, 30, 10) },
    'CRYSTAL': { prefix: 'X', label: 'CRYSTAL', w: 40, h: 20, defaultValue: '4MHz', pins: two(-10, 50, 10) },
    'POWER': { prefix: 'PWR', label: 'POWER', w: 20, h: 20, defaultValue: '', pins: [P(1, '1', 10, 20)] },
    'GROUND': { prefix: 'GND', label: 'GROUND', w: 20, h: 20, defaultValue: '', pins: [P(1, '1', 10, 0)] },
    'BUZZER': { prefix: 'BZ', label: 'BUZZER', w: 40, h: 40, defaultValue: '', pins: two(10, 30, 50) },
    'MOTOR': { prefix: 'M', label: 'MOTOR', w: 40, h: 40, defaultValue: '', pins: two(-10, 50, 20) },
    'NPN': { prefix: 'Q', label: 'NPN', w: 40, h: 40, defaultValue: 'BC547', pins: [P('B', 'B', -10, 20), P('C', 'C', 30, -10), P('E', 'E', 30, 50)] },
    'VIRTUAL-TERMINAL': { prefix: 'VT', label: 'VIRTUAL-TERMINAL', w: 240, h: 160, defaultValue: '', pins: [P('RXD', 'RXD', -10, 20), P('TXD', 'TXD', -10, 40), P('RTS', 'RTS', -10, 60), P('CTS', 'CTS', -10, 80)] },
    '7SEG-MPX2-CC': { prefix: 'DS', label: '7SEG-MPX2-CC', w: 120, h: 100, defaultValue: '', pins: SEGP.map((s, i) => P(s, s, 10 + 10 * i, 110)).concat([1, 2].map(d => P(d, String(d), 90 + 10 * d, 110))) },
    '7SEG-MPX2-CA': { prefix: 'DS', label: '7SEG-MPX2-CA', w: 120, h: 100, defaultValue: '', pins: SEGP.map((s, i) => P(s, s, 10 + 10 * i, 110)).concat([1, 2].map(d => P(d, String(d), 90 + 10 * d, 110))) },
    'LM044L': { prefix: 'LCD', label: 'LM044L', w: 300, h: 140, defaultValue: '', pins:
      ['VSS', 'VDD', 'VEE', 'RS', 'RW', 'E', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7'].map((n, i) => P(i + 1, n, 50 + 10 * i, 150)) },
    'TRAFFIC-LIGHTS': { prefix: 'TL', label: 'TRAFFIC-LIGHTS', w: 40, h: 100, defaultValue: '', pins: [P('R', 'RED', -10, 20), P('A', 'AMBER', -10, 50), P('G', 'GREEN', -10, 80)] },
    '74HC595': { prefix: 'U', label: '74HC595', w: 80, h: 120, defaultValue: '', pins: [
      P(14, 'DS', -10, 10), P(11, 'SH_CP', -10, 30), P(12, 'ST_CP', -10, 40), P(10, 'MR', -10, 60), P(13, 'OE', -10, 70),
      P(15, 'Q0', 90, 10), P(1, 'Q1', 90, 20), P(2, 'Q2', 90, 30), P(3, 'Q3', 90, 40), P(4, 'Q4', 90, 50), P(5, 'Q5', 90, 60), P(6, 'Q6', 90, 70), P(7, 'Q7', 90, 80), P(9, "Q7'", 90, 100)] },
    'L293D': { prefix: 'U', label: 'L293D', w: 100, h: 140, defaultValue: '', pins: [
      P(1, '1,2EN', -10, 20), P(2, '1A', -10, 40), P(7, '2A', -10, 50), P(9, '3,4EN', -10, 80), P(10, '3A', -10, 100), P(15, '4A', -10, 110),
      P(3, '1Y', 110, 40), P(6, '2Y', 110, 50), P(11, '3Y', 110, 100), P(14, '4Y', 110, 110)] },
    'RELAY': { prefix: 'RL', label: 'RELAY', w: 80, h: 60, defaultValue: '5V', pins: [P(1, '1', -10, 20), P(2, '2', -10, 40), P('COM', 'COM', 90, 30), P('NC', 'NC', 90, 10), P('NO', 'NO', 90, 50)] },
    'TERMINAL': { prefix: 'LBL', label: 'TERMINAL', w: 60, h: 20, defaultValue: 'NET1', pins: [P(1, '1', -10, 10)] },
    'OSCILLOSCOPE': { prefix: 'OSC', label: 'OSCILLOSCOPE', w: 100, h: 80, defaultValue: '', pins: ['A', 'B', 'C', 'D'].map((n, i) => P(n, n, -10, 10 + 20 * i)) },
    'LOGIC-ANALYSER': { prefix: 'LA', label: 'LOGIC-ANALYSER', w: 100, h: 100, defaultValue: '', pins: Array.from({ length: 8 }, (_, i) => P('A' + i, 'A' + i, -10, 10 + 10 * i)) },
    'LOGICPROBE': { prefix: 'LP', label: 'LOGICPROBE', w: 20, h: 20, defaultValue: '', pins: [P(1, '1', -10, 10)] },
    'POT-HG': { prefix: 'RV', label: 'POT-HG', w: 60, h: 40, defaultValue: '10k', pins: [P(1, '1', -10, 10), P(2, '2', 70, 10), P(3, '3', 30, -10)] },
    'DC-VOLTMETER': { prefix: 'VM', label: 'DC VOLTMETER', w: 80, h: 60, defaultValue: '', pins: [P('+', '+', -10, 20), P('-', '-', -10, 40)] }
  };
  for (const k in types) types[k].type = k;
  const KW = { 'PIC16F628A': 'mikrodenetleyici mcu pic', 'LED-RED': 'led kırmızı', 'LED-GREEN': 'led yeşil', 'LED-YELLOW': 'led sarı', 'LED-BLUE': 'led mavi', 'LED-BARGRAPH-RED': 'led bar çubuk',
    '7SEG-MPX1-CC': 'display gösterge ortak katot', '7SEG-MPX1-CA': 'display gösterge ortak anot', '7SEG-MPX4-CC': 'display gösterge 4 hane tarama ortak katot', '7SEG-MPX4-CA': 'display gösterge 4 hane tarama ortak anot',
    '7SEG-BCD': 'display gösterge bcd', 'LM016L': 'lcd ekran 16x2 hd44780', '7448': 'bcd kod çözücü decoder', '7447': 'bcd kod çözücü decoder', 'BUTTON': 'buton düğme push',
    'SWITCH': 'anahtar toggle', 'DIPSW_8': 'dip anahtar', 'KEYPAD-PHONETYPE': 'tuş takımı keypad 4x3', 'KEYPAD-SMALLCALC': 'tuş takımı keypad 4x4 hesap', 'LOGICSTATE': 'lojik giriş kaynak',
    'RES': 'direnç resistor', 'CAP': 'kondansatör kapasitör', 'CAP-ELEC': 'elektrolitik kondansatör', 'CRYSTAL': 'kristal osilatör', 'POWER': 'güç vcc +5v besleme', 'GROUND': 'toprak gnd şase',
    'BUZZER': 'zil ses hoparlör', 'MOTOR': 'dc motor', 'NPN': 'transistör bjt', 'VIRTUAL-TERMINAL': 'uart seri terminal rs232', 'LOGICPROBE': 'lojik prob ölçüm',
    '7SEG-MPX2-CC': 'display gösterge 2 hane tarama ortak katot', '7SEG-MPX2-CA': 'display gösterge 2 hane tarama ortak anot', 'LM044L': 'lcd ekran 20x4 hd44780',
    'TRAFFIC-LIGHTS': 'trafik lambası ışık', '74HC595': 'kaydırmalı yazmaç shift register seri paralel', 'L293D': 'motor sürücü h köprü driver',
    'RELAY': 'röle', 'TERMINAL': 'etiket ağ adı net label bağlantı', 'OSCILLOSCOPE': 'osiloskop scope dalga ölçüm', 'LOGIC-ANALYSER': 'lojik analizör analyzer zamanlama ölçüm',
    'POT-HG': 'potansiyometre trimpot ayarlı direnç analog gerilim', 'DC-VOLTMETER': 'voltmetre gerilim ölçer analog dc volt' };
  for (const k in KW) types[k].kw = KW[k];
  const DESC = { 'PIC16F628A': ['PIC16', 'PIC16 microcontroller (2048 words Flash, 224 bytes RAM, 128 bytes EEPROM, USART, CCP)', 'microcontroller mcu pic flash'],
    'LED-RED': ['ACTIVE', 'Animated LED model (red)', 'led diode light'], 'LED-GREEN': ['ACTIVE', 'Animated LED model (green)', 'led diode light'],
    'LED-YELLOW': ['ACTIVE', 'Animated LED model (yellow)', 'led diode light'], 'LED-BLUE': ['ACTIVE', 'Animated LED model (blue)', 'led diode light'],
    'LED-BARGRAPH-RED': ['DISPLAY', '10-segment LED bargraph display (red)', 'led bar graph'],
    '7SEG-MPX1-CC': ['DISPLAY', '1-digit 7-segment display, common cathode', 'seven segment display digit'],
    '7SEG-MPX1-CA': ['DISPLAY', '1-digit 7-segment display, common anode', 'seven segment display digit'],
    '7SEG-MPX2-CC': ['DISPLAY', '2-digit multiplexed 7-segment display, common cathode', 'seven segment display multiplexed'],
    '7SEG-MPX2-CA': ['DISPLAY', '2-digit multiplexed 7-segment display, common anode', 'seven segment display multiplexed'],
    '7SEG-MPX4-CC': ['DISPLAY', '4-digit multiplexed 7-segment display, common cathode', 'seven segment display multiplexed'],
    '7SEG-MPX4-CA': ['DISPLAY', '4-digit multiplexed 7-segment display, common anode', 'seven segment display multiplexed'],
    '7SEG-BCD': ['DISPLAY', '1-digit 7-segment display with BCD decoder', 'seven segment display bcd hex'],
    'LM016L': ['DISPLAY', '16x2 alphanumeric LCD module (HD44780 controller)', 'lcd display character alphanumeric'],
    'LM044L': ['DISPLAY', '20x4 alphanumeric LCD module (HD44780 controller)', 'lcd display character alphanumeric'],
    'TRAFFIC-LIGHTS': ['ACTIVE', 'Animated traffic lights model (red, amber, green)', 'traffic lights lamp'],
    '7448': ['74STD', 'BCD to 7-segment decoder/driver with pull-up outputs', 'decoder driver bcd seven segment ttl'],
    '7447': ['74STD', 'BCD to 7-segment decoder/driver with open-collector outputs (active low)', 'decoder driver bcd seven segment ttl'],
    '74HC595': ['74HC', '8-bit serial-in, parallel-out shift register with output latches', 'shift register serial parallel latch'],
    'BUTTON': ['ACTIVE', 'SPST push button (momentary)', 'push button switch momentary'], 'SWITCH': ['ACTIVE', 'SPST toggle switch (latching)', 'toggle switch spst'],
    'DIPSW_8': ['ACTIVE', '8-way DIP switch', 'dip switch'], 'KEYPAD-PHONETYPE': ['ACTIVE', '4x3 telephone keypad', 'keypad keyboard matrix'],
    'KEYPAD-SMALLCALC': ['ACTIVE', '4x4 calculator keypad', 'keypad keyboard matrix'], 'RELAY': ['ACTIVE', 'SPDT relay, 5V coil', 'relay coil contact'],
    'LOGICSTATE': ['ACTIVE', 'Logic state source - click to toggle', 'logic state source input toggle'],
    'LOGICPROBE': ['ACTIVE', 'Logic probe - shows 1, 0 or ?', 'logic probe indicator'],
    'RES': ['DEVICE', 'Generic resistor', 'resistor'], 'CAP': ['DEVICE', 'Generic non-electrolytic capacitor', 'capacitor ceramic'],
    'CAP-ELEC': ['DEVICE', 'Generic electrolytic capacitor', 'capacitor electrolytic polarised'],
    'CRYSTAL': ['DEVICE', 'Quartz crystal (drawing only - the clock is set by Fosc)', 'crystal oscillator quartz'],
    'BUZZER': ['ACTIVE', 'Piezo buzzer / sounder (DC or PWM driven)', 'buzzer sounder speaker beeper'], 'MOTOR': ['ACTIVE', 'Animated DC motor', 'dc motor'],
    'NPN': ['DEVICE', 'Generic NPN bipolar transistor (switch model)', 'transistor bjt npn'],
    'L293D': ['ANALOG', 'Quadruple half-H driver (push-pull, 600 mA)', 'motor driver h bridge'],
    'TERMINAL': ['', 'Default terminal (net label) - terminals with the same name are connected', 'terminal net label default'],
    'POWER': ['', 'Power terminal (+5V, logic 1)', 'power vcc vdd supply terminal'], 'GROUND': ['', 'Ground terminal (0V, logic 0)', 'ground gnd vss terminal'],
    'OSCILLOSCOPE': ['', '4-channel digital oscilloscope (A-D)', 'oscilloscope scope waveform'],
    'LOGIC-ANALYSER': ['', '8-channel logic analyser (A0-A7)', 'logic analyser analyzer timing'],
    'VIRTUAL-TERMINAL': ['', 'Virtual RS232 terminal (9600 baud, 8N1)', 'virtual terminal uart serial rs232'],
    'POT-HG': ['ACTIVE', 'Interactive potentiometer (high granularity) - drag the slider or click -/+', 'potentiometer pot variable resistor trimmer interactive'],
    'DC-VOLTMETER': ['', 'DC voltmeter (reads V(+) - V(-); - unconnected = ground)', 'dc voltmeter volt meter analog measure'] };
  for (const k in DESC) { types[k].lib = DESC[k][0]; types[k].desc = DESC[k][1]; types[k].kwEn = DESC[k][2]; }
  types.TERMINAL.label = 'DEFAULT';
  const categories = [
    { name: 'Microprocessor ICs', tr: 'Mikrodenetleyici', types: ['PIC16F628A'] },
    { name: 'Optoelectronics', tr: 'Göstergeler', types: ['LED-RED', 'LED-GREEN', 'LED-YELLOW', 'LED-BLUE', 'LED-BARGRAPH-RED', '7SEG-MPX1-CC', '7SEG-MPX1-CA', '7SEG-MPX2-CC', '7SEG-MPX2-CA', '7SEG-MPX4-CC', '7SEG-MPX4-CA', '7SEG-BCD', 'LM016L', 'LM044L', 'TRAFFIC-LIGHTS'] },
    { name: 'TTL 74 series', tr: 'Göstergeler kod çözücü', types: ['7448', '7447'] },
    { name: 'TTL 74HC series', tr: 'Göstergeler kaydırmalı', types: ['74HC595'] },
    { name: 'Switches & Relays', tr: 'Giriş', types: ['BUTTON', 'SWITCH', 'DIPSW_8', 'KEYPAD-PHONETYPE', 'KEYPAD-SMALLCALC', 'RELAY'] },
    { name: 'Debugging Tools', tr: 'Giriş Sanal Aletler', types: ['LOGICSTATE', 'LOGICPROBE'] },
    { name: 'Resistors', tr: 'Pasif', types: ['RES', 'POT-HG'] },
    { name: 'Capacitors', tr: 'Pasif', types: ['CAP', 'CAP-ELEC'] },
    { name: 'Miscellaneous', tr: 'Pasif', types: ['CRYSTAL'] },
    { name: 'Speakers & Sounders', tr: 'Çıkış/Aktüatör', types: ['BUZZER'] },
    { name: 'Electromechanical', tr: 'Çıkış/Aktüatör', types: ['MOTOR'] },
    { name: 'Transistors', tr: 'Çıkış/Aktüatör', types: ['NPN'] },
    { name: 'Analog ICs', tr: 'Çıkış/Aktüatör', types: ['L293D'] },
    { name: 'Terminals', tr: 'Pasif', mode: 'terminal', types: ['TERMINAL', 'POWER', 'GROUND'] },
    { name: 'Virtual Instruments', tr: 'Sanal Aletler', mode: 'instrument', types: ['OSCILLOSCOPE', 'LOGIC-ANALYSER', 'VIRTUAL-TERMINAL', 'DC-VOLTMETER'] }
  ];
  for (const c of categories) for (const t of c.types) { types[t].cat = c.name; types[t].mode = c.mode || 'component'; }
  const order = [].concat(...categories.map(c => c.types));

  function rotPt(t, rot, px, py) {
    const cx = t.w / 2, cy = t.h / 2;
    switch (((rot % 360) + 360) % 360) {
      case 90: return [cx + cy - py, cy - cx + px];
      case 180: return [t.w - px, t.h - py];
      case 270: return [cx - cy + py, cy + cx - px];
      default: return [px, py];
    }
  }
  function pinPos(part, num) {
    const t = types[part.type]; if (!t) return null;
    const p = t.pins.find(q => q.num === String(num)); if (!p) return null;
    const r = rotPt(t, part.rot || 0, p.x, p.y);
    return [part.x + r[0], part.y + r[1]];
  }
  function bbox(part) {
    const t = types[part.type], rot = (((part.rot || 0) % 360) + 360) % 360;
    if (rot === 90 || rot === 270) return { x: part.x + t.w / 2 - t.h / 2, y: part.y + t.h / 2 - t.w / 2, w: t.h, h: t.w };
    return { x: part.x, y: part.y, w: t.w, h: t.h };
  }

  function el(tag, attrs, parent, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const txt = (g, x, y, s, a) => el('text', Object.assign({ x, y, 'font-size': 7, 'font-family': 'Arial,sans-serif', fill: C.text }, a || {}), g, s);
  const line = (g, x1, y1, x2, y2, a) => el('line', Object.assign({ x1, y1, x2, y2, stroke: C.wire, 'stroke-width': 1.3 }, a || {}), g);
  const box = (g, t, a) => el('rect', Object.assign({ x: 0, y: 0, width: t.w, height: t.h, fill: C.body, stroke: C.edge, 'stroke-width': 1.5 }, a || {}), g);
  const hit = (g, x, y, w, h, key, cls) => { const a = { class: cls || 'btn-hit', x, y, width: w, height: h, fill: 'transparent', style: 'cursor:pointer' }; if (key != null) a['data-key'] = key; return el('rect', a, g); };
  const ref = (g, part, x, y, a) => txt(g, x, y, part.id, Object.assign({ 'font-size': 9 }, a || {}));

  function edgeOf(t, p) { return [Math.max(0, Math.min(t.w, p.x)), Math.max(0, Math.min(t.h, p.y))]; }
  function leads(g, t) {
    g._pins = g._pins || {};
    for (const p of t.pins) {
      const [ex, ey] = edgeOf(t, p);
      if (ex === p.x && ey === p.y) continue;
      line(g, ex, ey, p.x, p.y);
      g._pins[p.num] = el('rect', { x: (ex + p.x) / 2 - 2.5, y: (ey + p.y) / 2 - 2.5, width: 5, height: 5, fill: C.z }, g);
    }
  }
  function icPins(g, t, showNum) {
    leads(g, t);
    for (const p of t.pins) {
      const [ex, ey] = edgeOf(t, p);
      if (ey === p.y) {
        const left = p.x < 0;
        txt(g, left ? 4 : t.w - 4, p.y + 2.5, p.name, { 'text-anchor': left ? 'start' : 'end', 'font-size': 6.5 });
        if (showNum) txt(g, left ? -9 : t.w + 3, p.y - 2, p.num, { 'font-size': 5.5 });
      } else {
        txt(g, p.x, p.y > t.h ? t.h - 3 : 8, p.name, { 'text-anchor': 'middle', 'font-size': 5.5, fill: '#c9a0a0' });
      }
    }
  }
  function lit(g, key, e, attr, on, off) { (g._lit = g._lit || {})[key] = [e, attr, on || C.on, off || C.off]; }
  function digit(g, ox, oy, W, H, sw, pre, dp) {
    const L = ox, R = ox + W, a = oy, m = oy + H / 2, b = oy + H, e = sw * 0.625;
    const S = { A: [L + e, a, R - e, a], B: [R, a + e, R, m - e], C: [R, m + e, R, b - e], D: [L + e, b, R - e, b], E: [L, m + e, L, b - e], F: [L, a + e, L, m - e], G: [L + e, m, R - e, m] };
    for (const k in S) lit(g, pre + k, el('line', { x1: S[k][0], y1: S[k][1], x2: S[k][2], y2: S[k][3], stroke: C.off, 'stroke-width': sw, 'stroke-linecap': 'round' }, g), 'stroke');
    if (dp) lit(g, pre + 'DP', el('circle', { cx: R + sw * 1.75, cy: b, r: sw * 0.56, fill: C.off }, g), 'fill');
  }
  const LCDMAP = { 0x5C: '¥', 0x7E: '→', 0x7F: '←', 0xDF: '°', 0xE4: 'µ', 0xF4: 'Ω', 0xE0: 'α', 0xE2: 'β', 0xF7: 'π', 0xFF: '█' };
  const lcdChar = c => c >= 0x20 && c < 0x7E && c !== 0x5C ? String.fromCharCode(c) : LCDMAP[c] || (c < 0x20 ? '' : '·');

  const AU = { muted: true, ctx: null, osc: null, gain: null, src: new Map(), icons: new Set() };
  function audioSync() {
    if (typeof window === 'undefined') return;
    const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
    let f = 0; for (const v of AU.src.values()) if (v > f) f = v;
    const want = !AU.muted && f > 0;
    try {
      if (want && !AU.ctx) {
        AU.ctx = new Ctx(); AU.osc = AU.ctx.createOscillator(); AU.gain = AU.ctx.createGain();
        AU.osc.type = 'square'; AU.gain.gain.value = 0; AU.osc.connect(AU.gain); AU.gain.connect(AU.ctx.destination); AU.osc.start();
      }
      if (!AU.ctx) return;
      if (want && AU.ctx.state === 'suspended') AU.ctx.resume();
      const now = AU.ctx.currentTime;
      if (f > 0) AU.osc.frequency.setTargetAtTime(Math.min(8000, Math.max(40, f)), now, 0.005);
      AU.gain.gain.setTargetAtTime(want ? 0.035 : 0, now, 0.01);
    } catch (e) { }
  }
  const muteIcon = () => AU.muted ? '🔇' : '🔊';
  function setMuted(v) {
    AU.muted = !!v;
    for (const t of AU.icons) { if (!t.isConnected) { AU.icons.delete(t); continue; } t.textContent = muteIcon(); }
    audioSync();
    return AU.muted;
  }

  function lcdDraw(cols, rows, G) {
    return (g, t, part) => {
      box(g, t, { fill: '#2c6a2c', stroke: '#173d17' });
      leads(g, t);
      for (const p of t.pins) txt(g, 0, 0, p.name, { 'font-size': 5.5, fill: '#e8f3d8', transform: 'translate(' + (p.x + 2) + ',' + (t.h - 3) + ') rotate(-90)' });
      el('rect', { x: G.sx, y: G.sy, width: G.sw, height: G.sh, rx: 3, fill: '#93b52e', stroke: '#1a3a1a', 'stroke-width': 1.5 }, g);
      const cells = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = G.x0 + c * G.dx, y = G.y0 + r * G.dy;
        el('rect', { x, y, width: G.cw, height: G.ch, fill: '#88a92a' }, g);
        cells.push({ x, y, t: el('text', { class: 'lcd-ch', x: x + G.cw / 2, y: y + G.ch - 4, 'font-size': G.fs, 'font-weight': 'bold', 'font-family': '"Courier New",Menlo,monospace', 'text-anchor': 'middle', fill: '#16210a' }, g, ''), px: null, k: '' });
      }
      const cur = el('rect', { x: 0, y: 0, width: G.cw, height: 2, fill: '#16210a', opacity: 0 }, g);
      ref(g, part, 0, -4); txt(g, t.w, -4, part.type, { 'font-size': 8, 'text-anchor': 'end' });
      g._upd = (s, on) => {
        const L = on && s.lcd ? s.lcd : null;
        for (let i = 0; i < cells.length; i++) {
          const cell = cells[i], c = i % cols, ln = L ? L.lines[(i - c) / cols] || '' : '', code = c < ln.length ? ln.charCodeAt(c) : 32;
          const k = code < 16 && L && L.cg ? 'cg' + code + ':' + L.cg.slice((code & 7) * 8, (code & 7) * 8 + 8).join(',') : String(code);
          if (k === cell.k) continue;
          cell.k = k;
          if (cell.px) { cell.px.remove(); cell.px = null; }
          if (code < 16) {
            cell.t.textContent = '';
            if (L && L.cg) {
              cell.px = el('g', { fill: '#16210a' }, g);
              for (let y = 0; y < 8; y++) { const row = L.cg[(code & 7) * 8 + y] || 0; for (let x = 0; x < 5; x++) if ((row >> (4 - x)) & 1) el('rect', { x: cell.x + 0.5 + x * 2.05, y: cell.y + 1 + y * G.py, width: 1.85, height: G.py - 0.2 }, cell.px); }
            }
          } else cell.t.textContent = lcdChar(code);
        }
        const cp = L && L.cursor;
        if (cp && cp.col >= 0 && cp.col < cols && cp.row < rows) { const c = cells[cp.row * cols + cp.col]; cur.setAttribute('x', c.x); cur.setAttribute('y', c.y + G.ch - 2); cur.setAttribute('opacity', 1); }
        else cur.setAttribute('opacity', 0);
      };
    };
  }

  const SCOPEC = ['#f5e536', '#38b6ff', '#ff4b4b', '#3fe05a'];
  const draw = {
    'PIC16F628A'(g, t, part) {
      box(g, t); icPins(g, t, true);
      txt(g, 0, -4, part.id, { 'font-size': 10 }); txt(g, 0, t.h + 10, 'PIC16F628A', { 'font-size': 8 });
    },
    '7448'(g, t, part) {
      box(g, t); icPins(g, t, true);
      txt(g, 0, -4, part.id, { 'font-size': 10 }); txt(g, 0, t.h + 10, part.type, { 'font-size': 8 });
    },
    '7SEG-MPX1-CC'(g, t, part) {
      el('rect', { x: 0, y: 0, width: t.w, height: t.h, fill: '#2b0606', stroke: '#111' }, g);
      icPins(g, t, false);
      digit(g, 30, 18, 40, 76, 8, '', true);
      txt(g, 0, -4, part.id, { 'font-size': 9 });
    },
    '7SEG-MPX4-CC'(g, t, part) {
      el('rect', { x: 0, y: 0, width: t.w, height: t.h, fill: '#2b0606', stroke: '#111' }, g);
      icPins(g, t, false);
      for (let d = 0; d < 4; d++) digit(g, 22 + 45 * d, 14, 24, 58, 6, (d + 1), true);
      txt(g, 0, -4, part.id, { 'font-size': 9 }); txt(g, t.w, -4, part.type, { 'font-size': 7, 'text-anchor': 'end' });
    },
    '7SEG-BCD'(g, t, part) {
      el('rect', { x: 0, y: 0, width: t.w, height: t.h, fill: '#2b0606', stroke: '#111' }, g);
      icPins(g, t, false);
      digit(g, 16, 10, 18, 42, 5, '', false);
      txt(g, 0, -4, part.id, { 'font-size': 9 });
    },
    LED(g, t, part) {
      const [cOn, cOff] = LEDC[part.type];
      leads(g, t);
      line(g, 0, 10, 13, 10); line(g, 27, 10, 40, 10);
      const halo = el('circle', { cx: 20, cy: 10, r: 11, fill: cOn, opacity: 0 }, g);
      const tri = el('path', { d: 'M13,3 L13,17 L27,10 Z', fill: cOff, stroke: C.edge, 'stroke-width': 1.1 }, g);
      el('line', { x1: 27, y1: 3, x2: 27, y2: 17, stroke: C.edge, 'stroke-width': 1.5 }, g);
      for (const dx of [0, 5]) el('path', { d: 'M' + (19 + dx) + ',1 l5,-6 m-3,0 l3,0 l0,3', fill: 'none', stroke: C.edge, 'stroke-width': 0.9 }, g);
      lit(g, 'ON', tri, 'fill', cOn, cOff);
      g._upd = (s, on) => halo.setAttribute('opacity', on && s.lit && s.lit.ON ? 0.35 : 0);
      ref(g, part, 0, 27, { 'font-size': 8 });
    },
    'LED-BARGRAPH-RED'(g, t, part) {
      box(g, t, { fill: '#2b2b2b', stroke: '#111' });
      leads(g, t);
      for (let i = 0; i < 10; i++) lit(g, String(i + 1), el('rect', { x: 12, y: 6.5 + 10 * i, width: 26, height: 7, fill: C.off }, g), 'fill');
      ref(g, part, 0, -4);
    },
    LM016L: lcdDraw(16, 2, { sx: 10, sy: 10, sw: 220, sh: 70, x0: 18, dx: 12.8, y0: 20, dy: 30, cw: 11, ch: 21, fs: 17, py: 2.4 }),
    LM044L: lcdDraw(20, 4, { sx: 10, sy: 10, sw: 280, sh: 108, x0: 20, dx: 13.1, y0: 16, dy: 25, cw: 11, ch: 22, fs: 16, py: 2.5 }),
    'BUTTON'(g, t, part) {
      leads(g, t);
      line(g, -10, 10, 3, 10); line(g, 37, 10, 50, 10);
      el('circle', { cx: 6, cy: 10, r: 3, fill: C.bg, stroke: C.edge, 'stroke-width': 1.2 }, g);
      el('circle', { cx: 34, cy: 10, r: 3, fill: C.bg, stroke: C.edge, 'stroke-width': 1.2 }, g);
      g._bar = el('line', { x1: 3, y1: 1, x2: 37, y2: 1, stroke: C.edge, 'stroke-width': 2.5 }, g);
      el('line', { x1: 20, y1: 1, x2: 20, y2: -6, stroke: C.edge, 'stroke-width': 1.5 }, g);
      txt(g, 0, -10, part.value || part.id, { 'font-size': 10 });
      hit(g, -5, -22, 50, 40);
    },
    'SWITCH'(g, t, part) {
      leads(g, t);
      line(g, 0, 10, 4, 10); line(g, 36, 10, 40, 10);
      el('circle', { cx: 6, cy: 10, r: 2.5, fill: C.bg, stroke: C.edge, 'stroke-width': 1.2 }, g);
      el('circle', { cx: 34, cy: 10, r: 2.5, fill: C.bg, stroke: C.edge, 'stroke-width': 1.2 }, g);
      const lev = el('line', { x1: 7, y1: 9, x2: 31, y2: -3, stroke: C.edge, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
      txt(g, 0, -8, part.value || part.id, { 'font-size': 9 });
      hit(g, -5, -18, 50, 36);
      g._upd = (s, on) => { const c = on && s.sw; lev.setAttribute('x2', c ? 33 : 31); lev.setAttribute('y2', c ? 8 : -3); };
    },
    'DIPSW_8'(g, t, part) {
      box(g, t, { fill: '#c43a2c', stroke: '#6e1a12' });
      leads(g, t);
      txt(g, 35, -2, 'ON', { 'font-size': 6 }); ref(g, part, 0, -4, { 'font-size': 8 });
      const knobs = [];
      for (let i = 0; i < 8; i++) {
        const y = 10 + 10 * i;
        txt(g, 4, y + 2.5, String(i + 1), { 'font-size': 6, fill: '#fff' });
        el('rect', { x: 14, y: y - 3.5, width: 24, height: 7, fill: '#f4f4f4', stroke: '#333', 'stroke-width': 0.6 }, g);
        knobs.push(el('rect', { x: 15, y: y - 2.5, width: 10, height: 5, fill: '#333' }, g));
        hit(g, 0, y - 5, 50, 10, String(i + 1));
      }
      g._upd = (s, on) => knobs.forEach((k, i) => k.setAttribute('x', on && s.sws && s.sws[i + 1] ? 27 : 15));
    },
    KEYPAD(g, t, part) {
      box(g, t, { fill: '#3d3f45', stroke: '#1d1e22', rx: 4 });
      leads(g, t);
      for (const p of t.pins) if (p.x < 0) txt(g, -9, p.y - 2, p.name, { 'font-size': 5.5 }); else txt(g, p.x + 2, t.h + 8, p.name, { 'font-size': 5.5 });
      g._keys = {};
      t.keys.forEach((row, r) => row.forEach((k, c) => {
        const x = 20 + 30 * c, y = 20 + 30 * r;
        g._keys[k] = el('rect', { x: x - 12, y: y - 12, width: 24, height: 24, rx: 3, fill: '#e9e9e9', stroke: '#888', 'stroke-width': 0.8 }, g);
        txt(g, x, y + 4.5, k, { 'font-size': 13, 'font-weight': 'bold', 'text-anchor': 'middle', fill: '#222' });
        hit(g, x - 13, y - 13, 26, 26, k);
      }));
      ref(g, part, 0, -4);
      g._upd = (s, on) => { for (const k in g._keys) g._keys[k].setAttribute('fill', on && s.keys && s.keys[k] ? '#8db7ef' : '#e9e9e9'); };
    },
    'LOGICSTATE'(g, t, part) {
      leads(g, t);
      const b = box(g, t, { fill: '#f2f2f2', stroke: '#333', 'stroke-width': 1.2 });
      const d = txt(g, 10, 15, part.value === '1' ? '1' : '0', { 'font-size': 13, 'font-weight': 'bold', 'text-anchor': 'middle', fill: '#777' });
      ref(g, part, 0, -4, { 'font-size': 8 });
      hit(g, -2, -2, 24, 24);
      g._upd = (s, on) => {
        const v = on ? (s.level ? 1 : 0) : (part.value === '1' ? 1 : 0);
        d.textContent = String(v); d.setAttribute('fill', on ? '#fff' : '#777');
        b.setAttribute('fill', on ? (v ? C.hi : C.lo) : '#f2f2f2');
      };
    },
    'LOGICPROBE'(g, t, part) {
      leads(g, t);
      const b = box(g, t, { fill: '#f2f2f2', stroke: '#333', 'stroke-width': 1.2, rx: 3 });
      const d = txt(g, 10, 15, '?', { 'font-size': 13, 'font-weight': 'bold', 'text-anchor': 'middle', fill: '#777' });
      ref(g, part, 0, -4, { 'font-size': 8 });
      g._upd = (s, on) => {
        const v = on ? s.level : 2;
        d.textContent = v === 1 ? '1' : v === 0 ? '0' : '?'; d.setAttribute('fill', on && v !== 2 ? '#fff' : '#777');
        b.setAttribute('fill', on && v === 1 ? C.hi : on && v === 0 ? C.lo : '#f2f2f2');
      };
    },
    'RES'(g, t, part) {
      leads(g, t);
      line(g, -10, 10, 0, 10); line(g, 40, 10, 50, 10);
      el('rect', { x: 0, y: 6, width: 40, height: 8, fill: C.body, stroke: C.edge, 'stroke-width': 1.2 }, g);
      txt(g, 2, 3, part.id, { 'font-size': 6 }); txt(g, 38, 3, part.value || '', { 'font-size': 6, 'text-anchor': 'end' });
    },
    CAP(g, t, part) {
      leads(g, t);
      line(g, 0, 10, 8, 10); line(g, 12, 10, 20, 10);
      el('line', { x1: 8, y1: 1, x2: 8, y2: 19, stroke: C.edge, 'stroke-width': 2 }, g);
      if (part.type === 'CAP-ELEC') { el('path', { d: 'M15,1 Q11,10 15,19', fill: 'none', stroke: C.edge, 'stroke-width': 2 }, g); txt(g, 1, 5, '+', { 'font-size': 7 }); }
      else el('line', { x1: 12, y1: 1, x2: 12, y2: 19, stroke: C.edge, 'stroke-width': 2 }, g);
      txt(g, -6, -3, part.id, { 'font-size': 6 }); txt(g, -6, 28, part.value || '', { 'font-size': 6 });
    },
    'CRYSTAL'(g, t, part) {
      leads(g, t);
      line(g, 0, 10, 12, 10); line(g, 28, 10, 40, 10);
      el('line', { x1: 12, y1: 3, x2: 12, y2: 17, stroke: C.edge, 'stroke-width': 1.6 }, g);
      el('line', { x1: 28, y1: 3, x2: 28, y2: 17, stroke: C.edge, 'stroke-width': 1.6 }, g);
      el('rect', { x: 15, y: 1, width: 10, height: 18, fill: C.bg, stroke: C.edge, 'stroke-width': 1.2 }, g);
      txt(g, 0, -3, part.id, { 'font-size': 6 }); txt(g, 40, -3, part.value || '', { 'font-size': 6, 'text-anchor': 'end' });
    },
    'POWER'(g, t) {
      line(g, 10, 20, 10, 10);
      el('path', { d: 'M5,10 L15,10 L10,2 Z', fill: 'none', stroke: C.wire, 'stroke-width': 1.3 }, g);
    },
    'GROUND'(g, t) {
      line(g, 10, 0, 10, 8);
      for (let i = 0; i < 3; i++) line(g, 2 + i * 3, 8 + i * 4, 18 - i * 3, 8 + i * 4);
    },
    'BUZZER'(g, t, part) {
      leads(g, t);
      el('path', { d: 'M4,40 L4,20 A16,16 0 0 1 36,20 L36,40 Z', fill: C.body, stroke: C.edge, 'stroke-width': 1.5 }, g);
      el('circle', { cx: 20, cy: 22, r: 8, fill: '#3b3b3b' }, g);
      txt(g, 7, 37, '+', { 'font-size': 8 });
      const wv = el('g', { opacity: 0, fill: 'none', stroke: '#c03030', 'stroke-width': 1.3 }, g);
      for (const r of [6, 11, 16]) el('path', { d: 'M' + (38 + r * 0.3) + ',' + (20 - r) + ' A' + r + ',' + r + ' 0 0 1 ' + (38 + r * 0.3) + ',' + (20 + r), }, wv);
      ref(g, part, 0, -4);
      const ic = txt(g, 40, -3, muteIcon(), { 'font-size': 10, class: 'mute-hit', style: 'cursor:pointer', 'text-anchor': 'end' });
      AU.icons.add(ic);
      g._upd = (s, on) => {
        const snd = on && s.sound;
        wv.setAttribute('opacity', snd ? 1 : 0);
        if (part.id.indexOf('?') < 0) { AU.src.set(part.id, snd ? s.freq || 2000 : 0); audioSync(); }
      };
    },
    'MOTOR'(g, t, part) {
      leads(g, t);
      line(g, 0, 20, 4, 20); line(g, 36, 20, 40, 20);
      el('circle', { cx: 20, cy: 20, r: 16, fill: C.body, stroke: C.edge, 'stroke-width': 1.5 }, g);
      const rot = el('g', {}, g);
      el('path', { d: 'M20,20 L20,6 M20,20 L32,27 M20,20 L8,27', stroke: '#555', 'stroke-width': 1.2 }, rot);
      el('circle', { cx: 20, cy: 6.5, r: 2, fill: '#c03030' }, rot);
      txt(g, 20, 24, 'M', { 'font-size': 11, 'font-weight': 'bold', 'text-anchor': 'middle', fill: '#222' });
      ref(g, part, 0, -4);
      let curSpin = 0, anim = null;
      g._upd = (s, on) => {
        const sp = on ? Math.round((s.spin || 0) * 10) / 10 : 0;
        if (sp === curSpin) return;
        curSpin = sp;
        if (anim) { anim.remove(); anim = null; }
        if (!sp) return;
        anim = el('animateTransform', { attributeName: 'transform', type: 'rotate', from: '0 20 20', to: (sp > 0 ? 360 : -360) + ' 20 20', dur: (0.6 / Math.abs(sp)).toFixed(2) + 's', repeatCount: 'indefinite' }, rot);
        if (anim.beginElement) try { anim.beginElement(); } catch (e) { }
      };
    },
    'NPN'(g, t, part) {
      leads(g, t);
      el('circle', { cx: 20, cy: 20, r: 17, fill: 'none', stroke: C.edge, 'stroke-width': 1.2 }, g);
      line(g, 0, 20, 13, 20);
      el('line', { x1: 13, y1: 9, x2: 13, y2: 31, stroke: C.edge, 'stroke-width': 2.2 }, g);
      el('path', { d: 'M13,15 L30,6 L30,0', fill: 'none', stroke: C.edge, 'stroke-width': 1.3 }, g);
      el('path', { d: 'M13,25 L30,34 L30,40', fill: 'none', stroke: C.edge, 'stroke-width': 1.3 }, g);
      el('path', { d: 'M30,34 L22.5,33.6 L25.8,28.2 Z', fill: C.edge }, g);
      txt(g, 40, 14, part.id, { 'font-size': 8 }); txt(g, 40, 32, part.value || '', { 'font-size': 6 });
    },
    'VIRTUAL-TERMINAL'(g, t, part) {
      box(g, t);
      leads(g, t);
      for (const p of t.pins) txt(g, 3, p.y + 2.5, p.name, { 'font-size': 6 });
      txt(g, 34, 10, 'VIRTUAL TERMINAL', { 'font-size': 7, 'font-weight': 'bold' });
      const scr = el('rect', { x: 34, y: 14, width: 200, height: 140, fill: '#101410', stroke: '#444', 'stroke-width': 1 }, g);
      const rows = [];
      for (let i = 0; i < 13; i++) rows.push(el('text', { x: 38, y: 24 + 10 * i, 'font-size': 9, 'font-family': 'Menlo,Consolas,monospace', fill: '#7dfc8a', 'xml:space': 'preserve' }, g, ''));
      ref(g, part, 0, -4);
      hit(g, 34, 14, 200, 140, null, 'term-hit');
      g._focus = v => { scr.setAttribute('stroke', v ? '#2f6fd0' : '#444'); scr.setAttribute('stroke-width', v ? 2.5 : 1); };
      g._upd = (s, on) => {
        const out = [];
        if (on && s.text) for (const ln of s.text.split('\n')) { if (!ln.length) out.push(''); for (let i = 0; i < ln.length; i += 36) out.push(ln.slice(i, i + 36)); }
        const v = out.slice(-13);
        rows.forEach((r, i) => { r.textContent = v[i] || ''; });
      };
    },
    '7SEG-MPX2-CC'(g, t, part) {
      el('rect', { x: 0, y: 0, width: t.w, height: t.h, fill: '#2b0606', stroke: '#111' }, g);
      icPins(g, t, false);
      for (let d = 0; d < 2; d++) digit(g, 26 + 50 * d, 14, 24, 58, 6, (d + 1), true);
      txt(g, 0, -4, part.id, { 'font-size': 9 }); txt(g, t.w, -4, part.type, { 'font-size': 7, 'text-anchor': 'end' });
    },
    'TRAFFIC-LIGHTS'(g, t, part) {
      leads(g, t);
      el('rect', { x: 0, y: 0, width: t.w, height: t.h, rx: 6, fill: '#2b2b2b', stroke: '#111', 'stroke-width': 1.2 }, g);
      [['R', 20, '#ff2a1a', '#4a1210'], ['A', 50, '#ffb31a', '#4a3410'], ['G', 80, '#2ee82e', '#12401a']].forEach(([k, y, on, off]) => lit(g, k, el('circle', { cx: 20, cy: y, r: 11, fill: off, stroke: '#000', 'stroke-width': 0.8 }, g), 'fill', on, off));
      ref(g, part, 0, -4);
    },
    '74HC595'(g, t, part) {
      box(g, t); icPins(g, t, true);
      txt(g, 0, -4, part.id, { 'font-size': 10 }); txt(g, 0, t.h + 10, '74HC595', { 'font-size': 8 });
      txt(g, 26, 92, 'SRG8', { 'font-size': 7, fill: C.edge });
    },
    'L293D'(g, t, part) {
      box(g, t); icPins(g, t, true);
      txt(g, 0, -4, part.id, { 'font-size': 10 }); txt(g, 0, t.h + 10, 'L293D', { 'font-size': 8 });
    },
    'RELAY'(g, t, part) {
      leads(g, t);
      line(g, 0, 20, 14, 20); line(g, 0, 40, 14, 40);
      el('rect', { x: 14, y: 14, width: 16, height: 32, fill: C.body, stroke: C.edge, 'stroke-width': 1.3 }, g);
      el('line', { x1: 14, y1: 46, x2: 30, y2: 14, stroke: C.edge, 'stroke-width': 1 }, g);
      el('line', { x1: 30, y1: 30, x2: 50, y2: 30, stroke: C.edge, 'stroke-width': 0.8, 'stroke-dasharray': '2 2' }, g);
      line(g, 80, 30, 60, 30); line(g, 80, 10, 70, 10); line(g, 70, 10, 70, 18); line(g, 80, 50, 70, 50); line(g, 70, 50, 70, 42);
      el('circle', { cx: 60, cy: 30, r: 2, fill: C.edge }, g);
      const arm = el('line', { x1: 60, y1: 30, x2: 71, y2: 18, stroke: C.edge, 'stroke-width': 2, 'stroke-linecap': 'round' }, g);
      txt(g, 82, 7, 'NC', { 'font-size': 5.5 }); txt(g, 82, 47, 'NO', { 'font-size': 5.5 }); txt(g, 82, 27, 'COM', { 'font-size': 5.5 });
      ref(g, part, 0, -4); txt(g, 40, 58, part.value || '', { 'font-size': 6 });
      g._upd = (s, on) => arm.setAttribute('y2', on && s.sw ? 42 : 18);
    },
    'TERMINAL'(g, t, part) {
      leads(g, t);
      el('path', { d: 'M0,10 L8,2 L60,2 L60,18 L8,18 Z', fill: 'none', stroke: C.wire, 'stroke-width': 1.2 }, g);
      const flip = (((part.rot || 0) % 360) + 360) % 360 === 180;
      txt(g, 34, 13, part.value || '', { 'font-size': 8, 'font-weight': 'bold', 'text-anchor': 'middle', fill: C.text, transform: flip ? 'rotate(180,34,10)' : '' });
    },
    'OSCILLOSCOPE'(g, t, part) {
      leads(g, t);
      box(g, t, { fill: '#3a3d44', stroke: '#16171a', rx: 3 });
      el('rect', { x: 26, y: 8, width: 66, height: 52, fill: '#0c1a10', stroke: '#555', 'stroke-width': 0.8 }, g);
      for (let i = 1; i < 4; i++) el('line', { x1: 26 + 16.5 * i, y1: 8, x2: 26 + 16.5 * i, y2: 60, stroke: '#24402c', 'stroke-width': 0.5 }, g);
      el('path', { d: 'M28,40 L40,40 L40,22 L56,22 L56,40 L72,40 L72,22 L88,22', fill: 'none', stroke: SCOPEC[0], 'stroke-width': 1.2 }, g);
      el('path', { d: 'M28,52 C38,44 46,44 56,52 S74,60 88,50', fill: 'none', stroke: SCOPEC[1], 'stroke-width': 1 }, g);
      t.pins.forEach((p, i) => { el('circle', { cx: 8, cy: p.y, r: 4, fill: SCOPEC[i], stroke: '#111', 'stroke-width': 0.6 }, g); txt(g, 15, p.y + 2.5, p.name, { 'font-size': 7, 'font-weight': 'bold', fill: '#eee' }); });
      txt(g, 26, 72, 'OSCILLOSCOPE', { 'font-size': 6.5, fill: '#ddd' });
      ref(g, part, 0, -4);
    },
    'POT-HG'(g, t, part) {
      leads(g, t);
      line(g, 0, 10, 10, 10); line(g, 50, 10, 60, 10); line(g, 30, 0, 30, -10);
      el('rect', { x: 10, y: 5, width: 40, height: 10, fill: C.body, stroke: C.edge, 'stroke-width': 1.2 }, g);
      const wip = el('path', { d: '', fill: 'none', stroke: C.edge, 'stroke-width': 1.2 }, g);
      const head = el('path', { d: '', fill: C.edge }, g);
      txt(g, 0, -3, part.id, { 'font-size': 7 }); txt(g, 60, -3, part.value || '', { 'font-size': 7, 'text-anchor': 'end' });
      el('rect', { x: 1, y: 23, width: 11, height: 11, rx: 2, fill: '#f2f2f2', stroke: '#555', 'stroke-width': 0.8 }, g);
      el('rect', { x: 48, y: 23, width: 11, height: 11, rx: 2, fill: '#f2f2f2', stroke: '#555', 'stroke-width': 0.8 }, g);
      txt(g, 6.5, 32, '−', { 'font-size': 10, 'font-weight': 'bold', 'text-anchor': 'middle', fill: '#222' });
      txt(g, 53.5, 32, '+', { 'font-size': 10, 'font-weight': 'bold', 'text-anchor': 'middle', fill: '#222' });
      el('rect', { x: 15, y: 27, width: 30, height: 3, rx: 1.5, fill: '#777' }, g);
      const knob = el('rect', { x: 27, y: 23, width: 6, height: 11, rx: 1.5, fill: '#2f6fd0', stroke: '#173a70', 'stroke-width': 0.6 }, g);
      const pct = txt(g, 30, 45, '', { 'font-size': 7, 'text-anchor': 'middle' });
      hit(g, 0, 22, 13, 13, '-');
      hit(g, 47, 22, 13, 13, '+');
      el('rect', { class: 'pot-hit', x: 14, y: 21, width: 32, height: 15, fill: 'transparent', style: 'cursor:ew-resize' }, g);
      const set = (x, on, v) => {
        const wx = 10 + 40 * x;
        wip.setAttribute('d', 'M30,0 L' + wx.toFixed(1) + ',0 L' + wx.toFixed(1) + ',1.5');
        head.setAttribute('d', 'M' + (wx - 2.5).toFixed(1) + ',0.5 L' + (wx + 2.5).toFixed(1) + ',0.5 L' + wx.toFixed(1) + ',5 Z');
        knob.setAttribute('x', (15 + 30 * x - 3).toFixed(1));
        pct.textContent = Math.round(x * 100) + '%' + (on && v != null ? '  ' + v.toFixed(2) + 'V' : '');
      };
      const p0 = typeof part.pos === 'number' ? part.pos : 0.5;
      set(p0, false);
      g._upd = (s, on) => set(on && typeof s.pos === 'number' ? s.pos : p0, on, s.volts);
    },
    'DC-VOLTMETER'(g, t, part) {
      leads(g, t);
      box(g, t, { fill: '#3a3d44', stroke: '#16171a', rx: 3 });
      txt(g, 4, 22.5, '+', { 'font-size': 9, 'font-weight': 'bold', fill: '#ff6a6a' });
      txt(g, 4, 43.5, '−', { 'font-size': 9, 'font-weight': 'bold', fill: '#8fb0ff' });
      el('rect', { x: 14, y: 10, width: 60, height: 28, fill: '#0c1a10', stroke: '#555', 'stroke-width': 0.8 }, g);
      const d = el('text', { x: 70, y: 31, 'font-size': 15, 'font-family': 'Menlo,Consolas,monospace', 'text-anchor': 'end', fill: '#3a4a3a' }, g, '0.00');
      txt(g, 44, 50, 'Volts', { 'font-size': 7, 'text-anchor': 'middle', fill: '#ddd' });
      ref(g, part, 0, -4);
      g._upd = (s, on) => {
        const v = on ? s.volts : undefined;
        d.textContent = !on ? '0.00' : v == null ? '-.--' : (v < -0.0005 ? '-' : '+') + Math.abs(v).toFixed(2);
        d.setAttribute('fill', on ? '#7dfc8a' : '#3a4a3a');
      };
    },
    'LOGIC-ANALYSER'(g, t, part) {
      leads(g, t);
      box(g, t, { fill: '#3a3d44', stroke: '#16171a', rx: 3 });
      el('rect', { x: 30, y: 6, width: 64, height: 78, fill: '#0c1a10', stroke: '#555', 'stroke-width': 0.8 }, g);
      for (const p of t.pins) {
        txt(g, 4, p.y + 2.5, p.name, { 'font-size': 6.5, fill: '#eee' });
        const k = +p.name.slice(1), y = p.y + 2, d = [];
        let x = 32, hi = k & 1;
        d.push('M' + x + ',' + (hi ? y - 5 : y));
        while (x < 92) { const w = 4 + ((k * 7 + x) % 9); x = Math.min(92, x + w); d.push('L' + x + ',' + (hi ? y - 5 : y)); hi ^= 1; if (x < 92) d.push('L' + x + ',' + (hi ? y - 5 : y)); }
        el('path', { d: d.join(' '), fill: 'none', stroke: '#3ee06a', 'stroke-width': 0.8 }, g);
      }
      txt(g, 30, 94, 'LOGIC ANALYSER', { 'font-size': 6, fill: '#ddd' });
      ref(g, part, 0, -4);
    }
  };
  for (const k of ['LED-RED', 'LED-GREEN', 'LED-YELLOW', 'LED-BLUE']) draw[k] = draw.LED;
  draw['7447'] = draw['7448']; draw['7SEG-MPX1-CA'] = draw['7SEG-MPX1-CC']; draw['7SEG-MPX4-CA'] = draw['7SEG-MPX4-CC']; draw['7SEG-MPX2-CA'] = draw['7SEG-MPX2-CC'];
  draw['KEYPAD-PHONETYPE'] = draw['KEYPAD-SMALLCALC'] = draw.KEYPAD; draw['CAP-ELEC'] = draw.CAP;

  function render(part, parent) {
    const t = types[part.type];
    const g = el('g', { class: 'part', 'data-id': part.id, transform: 'translate(' + part.x + ',' + part.y + ') rotate(' + (part.rot || 0) + ',' + t.w / 2 + ',' + t.h / 2 + ')' }, parent);
    el('rect', { class: 'part-hit', x: 0, y: 0, width: t.w, height: t.h, fill: 'transparent' }, g);
    draw[part.type](g, t, part);
    return g;
  }
  function update(g, part, state) {
    state = state || {};
    const on = !!state.on;
    if (g._pins) for (const n in g._pins) {
      const v = on && state.pins ? state.pins[n] : 2;
      g._pins[n].setAttribute('fill', v === 1 ? C.hi : v === 0 ? C.lo : C.z);
    }
    if (g._lit) for (const k in g._lit) {
      const [e, a, cOn, cOff] = g._lit[k];
      e.setAttribute(a, on && state.lit && state.lit[k] ? cOn : cOff);
    }
    if (g._bar) { const y = on && state.pressed ? 7 : 1; g._bar.setAttribute('y1', y); g._bar.setAttribute('y2', y); }
    if (g._upd) g._upd(state, on);
  }
  function focus(g, v) { if (g && g._focus) g._focus(!!v); }

  const SI = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, Meg: 1e6, G: 1e9, T: 1e12 };
  function parseEng(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(Meg|[pnuµμmkKMGT])?\s*(?:Hz|HZ|hz|s|S|F|V|A|ohm|Ω)?\s*$/.exec(String(v == null ? '' : v));
    if (!m) return NaN;
    return +(parseFloat(m[1]) * (m[2] ? SI[m[2]] : 1)).toPrecision(12);
  }
  function fmtEng(x, unit) {
    if (!isFinite(x)) return '';
    unit = unit || '';
    if (x === 0) return '0' + unit;
    const a = Math.abs(x), tab = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p']];
    for (const [f, sfx] of tab) if (a >= f * 0.9999999) return +(x / f).toPrecision(9) + sfx + unit;
    return +(x / 1e-12).toPrecision(9) + 'p' + unit;
  }
  const BAUDS = [110, 300, 1200, 2400, 4800, 9600, 19200, 38400, 57600];
  const TERM_DEF = { baud: 9600, dataBits: 8, parity: 'NONE', stopBits: 1, xonxoff: 0, sigPol: 0, ctlPol: 0 };
  const PIC_DEF = { clock: '1MHz', wdtPeriod: '18m', eeDelay: '10m', cfgword: '0x3F6B' };
  const LCD_CLOCK = 250e3, TTRIGMIN = 1e-3;
  types['VIRTUAL-TERMINAL'].defaults = TERM_DEF; types['VIRTUAL-TERMINAL'].baudList = BAUDS;
  types['PIC16F628A'].defaults = PIC_DEF; types.LM016L.defaults = types.LM044L.defaults = { clock: '250kHz' };
  for (const t of ['7SEG-MPX1-CC', '7SEG-MPX1-CA', '7SEG-MPX2-CC', '7SEG-MPX2-CA', '7SEG-MPX4-CC', '7SEG-MPX4-CA', '7SEG-BCD']) types[t].defaults = { ttrigmin: '1ms' };
  function termCfg(part) {
    const p = part || {}, d = TERM_DEF, num = (x, def) => { const n = +x; return isFinite(n) && x !== '' && x != null ? n : def; };
    const par = String(p.parity == null ? d.parity : p.parity).toUpperCase();
    return { baud: Math.max(1, Math.round(num(p.baud, d.baud))), dataBits: +p.dataBits === 7 ? 7 : 8, parity: par === 'EVEN' || par === 'ODD' ? par : 'NONE',
      stopBits: +p.stopBits === 2 ? 2 : 1, xonxoff: +p.xonxoff ? 1 : 0, sigPol: +p.sigPol ? 1 : 0, ctlPol: +p.ctlPol ? 1 : 0 };
  }
  function b64bytes(s) {
    if (!s) return null;
    try { return typeof Buffer !== 'undefined' ? new Uint8Array(Buffer.from(s, 'base64')) : Uint8Array.from(atob(s), c => c.charCodeAt(0)); } catch (e) { return null; }
  }
  function picProps(part, defClockHz) {
    const p = part || {}, num = (v, def) => { const x = parseEng(v); return x > 0 && isFinite(x) ? x : def; };
    const ck = parseEng(p.clock), cw = p.cfgword == null || p.cfgword === '' ? NaN : Number(p.cfgword);
    return { clockHz: ck >= 32e3 && ck <= 20e6 ? ck : (defClockHz > 0 ? defClockHz : 1e6), clockSet: ck >= 32e3 && ck <= 20e6,
      cfgword: cw >= 0 && cw <= 0x3FFF ? cw : null, wdtPeriod: num(p.wdtPeriod, 0.018), eeWriteDelay: num(p.eeDelay, 0.010), eeBin: b64bytes(p.eeBinB64) };
  }
  const OPT = (...a) => a.map(v => [v, String(v)]);
  function editFields(part, ctx) {
    ctx = ctx || {};
    const p = part || {}, fields = [];
    const rng = (lo, hi, unit, what) => s => { const x = parseEng(s); return x >= lo && x <= hi ? { ok: true, value: fmtEng(x, unit) } : { ok: false, msg: what + ' must be between ' + fmtEng(lo, unit) + ' and ' + fmtEng(hi, unit) + ' (e.g. ' + fmtEng(lo * 10, unit) + ').' }; };
    switch (p.type) {
      case 'PIC16F628A': {
        const c = picProps(p, ctx.projectClockHz);
        fields.push({ key: 'clock', label: 'Processor Clock Frequency:', value: p.clock || (ctx.projectClockHz > 0 ? fmtEng(ctx.projectClockHz, 'Hz') : PIC_DEF.clock), validate: rng(32e3, 20e6, 'Hz', 'Processor Clock Frequency'),
          title: 'Independent of the mikroC project clock. Examples: 4MHz, 32.768kHz.' });
        fields.push({ key: 'cfgword', label: 'Program Configuration Word:', value: p.cfgword == null ? '' : p.cfgword, placeholder: ctx.cfgHint || PIC_DEF.cfgword, title: 'Overridden by the CONFIG word in the HEX file.',
          validate: s => { s = String(s).trim(); if (!s) return { ok: true, value: '' }; const n = /^(0x|\$)/i.test(s) ? parseInt(s.replace(/^\$/, '0x'), 16) : /^[0-9a-f]+h$/i.test(s) ? parseInt(s, 16) : Number(s); return n >= 0 && n <= 0x3FFF && n === n ? { ok: true, value: '0x' + n.toString(16).toUpperCase().padStart(4, '0') } : { ok: false, msg: 'Program Configuration Word must be 0x0000-0x3FFF.' }; } });
        fields.push({ key: 'wdtPeriod', label: 'Watchdog Timer Period:', value: p.wdtPeriod || PIC_DEF.wdtPeriod, advanced: true, validate: rng(1e-3, 60, '', 'Watchdog Timer Period') });
        fields.push({ key: 'eeDelay', label: 'Data EEPROM Write Delay:', value: p.eeDelay || PIC_DEF.eeDelay, advanced: true, validate: rng(1e-6, 1, '', 'Data EEPROM Write Delay') });
        fields.push({ key: 'eeBin', label: 'Initial contents of EEPROM:', value: p.eeBin || '', advanced: true, file: '.bin', fileData: 'eeBinB64', title: 'Raw 128-byte *.BIN file (default: 128 x 0xFF)' });
        fields.push({ key: 'randDmem', label: 'Randomize Data Memory?', value: 'No', options: [['No', 'No']], advanced: true, disabled: true, noStore: true });
        fields.push({ key: 'startDelay', label: 'Model PIC Start-up Delays?', value: 'No', options: [['No', 'No']], advanced: true, disabled: true, noStore: true });
        fields.picProps = c;
        break;
      }
      case 'VIRTUAL-TERMINAL': {
        const t = termCfg(p);
        fields.push({ key: 'baud', label: 'Baud Rate:', value: String(t.baud), combo: BAUDS.map(String), validate: s => { const n = Number(String(s).trim()); return n >= 50 && n <= 250000 && Math.round(n) === n ? { ok: true, value: n } : { ok: false, msg: 'Baud Rate must be an integer between 50 and 250000.' }; } });
        fields.push({ key: 'dataBits', label: 'Data Bits:', value: String(t.dataBits), options: OPT(7, 8), cast: Number });
        fields.push({ key: 'parity', label: 'Parity:', value: t.parity, options: [['NONE', 'NONE'], ['EVEN', 'EVEN'], ['ODD', 'ODD']] });
        fields.push({ key: 'stopBits', label: 'Stop Bits:', value: String(t.stopBits), options: OPT(1, 2), cast: Number });
        fields.push({ key: 'xonxoff', label: 'Send XON/XOFF:', value: String(t.xonxoff), options: [[0, 'No'], [1, 'Yes']], cast: Number });
        fields.push({ key: 'sigPol', label: 'RX/TX Polarity:', value: String(t.sigPol), options: [[0, 'Normal'], [1, 'Inverted']], cast: Number, advanced: true });
        fields.push({ key: 'ctlPol', label: 'RTS/CTS Polarity:', value: String(t.ctlPol), options: [[0, 'Normal'], [1, 'Inverted']], cast: Number, advanced: true });
        break;
      }
      case 'LM016L': case 'LM044L':
        fields.push({ key: 'clock', label: 'Clock Frequency:', value: p.clock || fmtEng(LCD_CLOCK, 'Hz'), validate: rng(50e3, 1e6, 'Hz', 'Clock Frequency'), advanced: true, title: 'Sets HD44780 command timing (default 250kHz).' });
        break;
      case '7SEG-MPX1-CC': case '7SEG-MPX1-CA': case '7SEG-MPX2-CC': case '7SEG-MPX2-CA': case '7SEG-MPX4-CC': case '7SEG-MPX4-CA': case '7SEG-BCD':
        fields.push({ key: 'ttrigmin', label: 'Minimum Trigger Time:', value: p.ttrigmin || fmtEng(TTRIGMIN, 's'), validate: rng(1e-6, 1, 's', 'Minimum Trigger Time'), advanced: true, title: 'A segment lights only if driven continuously for at least this long.' });
        break;
    }
    return fields;
  }
  function applyField(part, f, raw) {
    const r = f.validate ? f.validate(raw) : { ok: true, value: f.cast ? f.cast(raw) : raw };
    if (!r.ok) return r;
    const v = r.value, def = (types[part.type].defaults || {})[f.key];
    if (v === '' || v == null || (def !== undefined && String(v) === String(def) && !(part.type === 'PIC16F628A' && (f.key === 'clock' || f.key === 'cfgword')))) delete part[f.key]; else part[f.key] = v;
    return r;
  }

  const LIB = { types, order, categories, colors: C, scopeColors: SCOPEC, pinPos, bbox, render, update, focus, lcdChar, setMuted, muted: () => AU.muted,
    parseEng, fmtEng, termCfg, picProps, editFields, applyField, LCD_CLOCK, TTRIGMIN };
  if (typeof module !== 'undefined' && module.exports) module.exports = LIB;
  if (root) root.LIB = LIB;
})(typeof window !== 'undefined' ? window : null);
