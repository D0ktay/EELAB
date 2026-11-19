unsigned char led = 1;

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
			Delay_ms(200);
		} else if (Button(&PORTA, 1, 20, 1)) {
			PORTB = ~PORTB;
			Delay_ms(200);
		} else {
			PORTB = 0x00;
			led = 1;
		}
	}
}
