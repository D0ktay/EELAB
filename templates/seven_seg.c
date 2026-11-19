const unsigned char seg[] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
unsigned int sayi = 0;
unsigned char hane[4];
unsigned char i, t;

void main() {
	CMCON = 0x07;
	TRISA = 0xF0;
	TRISB = 0x00;
	PORTA = 0x0F;
	PORTB = 0x00;

	while (1) {
		hane[0] = sayi / 1000;
		hane[1] = (sayi / 100) % 10;
		hane[2] = (sayi / 10) % 10;
		hane[3] = sayi % 10;
		for (t = 0; t < 5; t++) {
			for (i = 0; i < 4; i++) {
				PORTA = 0x0F;
				PORTB = seg[hane[i]];
				PORTA = ~(1 << i) & 0x0F;
				Delay_ms(5);
			}
		}
		sayi++;
		if (sayi > 9999) {
			sayi = 0;
		}
	}
}
