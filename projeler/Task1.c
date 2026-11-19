int ones = 0;
int tens = 0;
int hundreds = 0;
int running = 0;
int i = 0;

void main() {
	PCON.OSCF = 1;
	CMCON = 0x07;
	TRISA = 0xF0;
	TRISB = 0x00;
	PORTA = 0x00;
	PORTB = 0x00;

	while(1) {

		// 100 ms bekle, ama butonlari her 10 ms'de bir kontrol et
		for(i = 0; i < 10; i++) {
			delay_ms(10);

			if(RA5_bit == 1) {
				running = !running;
				while(RA5_bit == 1) { }
			}

			if(RA6_bit == 1) {
				ones = 0;
				tens = 0;
				hundreds = 0;
				PORTA = 0x00;
				PORTB = 0x00;
			}
		}

		if(running == 1) {
			ones++;
			if(ones == 10) {
				ones = 0;
				tens++;
			}
			if(tens == 10) {
				tens = 0;
				hundreds++;
			}
			if(hundreds == 10) {
				hundreds = 0;
			}
		}

		PORTA = ones;
		PORTB = (hundreds << 4) | tens;
	}
}
