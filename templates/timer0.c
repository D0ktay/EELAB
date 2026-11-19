unsigned char sayac = 0;

void interrupt() {
	if (INTCON.T0IF) {
		INTCON.T0IF = 0;
		sayac++;
		if (sayac >= 244) {
			sayac = 0;
			PORTB.B0 = ~PORTB.B0;
		}
	}
}

void main() {
	CMCON = 0x07;
	TRISB = 0x00;
	PORTB = 0x00;
	OPTION_REG = 0x82;
	TMR0 = 0;
	INTCON.T0IF = 0;
	INTCON.T0IE = 1;
	INTCON.GIE = 1;

	while (1) {
	}
}
