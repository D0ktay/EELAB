unsigned char birler = 0;
unsigned char onlar = 0;
unsigned char yuzler = 0;

void main() {
	CMCON = 0x07;
	TRISA = 0xF0;
	TRISB = 0x00;
	PORTA = 0x00;
	PORTB = 0x00;

	while (1) {
		Delay_ms(100);
		birler++;
		if (birler == 10) {
			birler = 0;
		}
		PORTA = birler;
		PORTB = (yuzler << 4) | onlar;
	}
}
