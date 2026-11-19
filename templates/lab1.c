unsigned char led = 1;
unsigned char t;

void main() {
	CMCON = 0x07;
	TRISA = 0xFF;
	TRISB = 0x00;
	PORTB = 0x00;

	while (1) {
		if (PORTA.B0 == 1) {
			PORTB = led;
			led = led << 1;
			if (led == 0) {
				led = 1;
			}
			for (t = 0; t < 20 && PORTA.B0 == 1; t++) {
				Delay_ms(10);	// 200 ms adım; RA0 bırakılınca hemen çıkar
			}
		} else if (PORTA.B1 == 1) {
			PORTB = 0xFF;
		} else {
			PORTB = 0x00;
		}
	}
}
