void interrupt() {
	if (PIR1.CMIF) {
		PORTB.B0 = CMCON.C1OUT;
		PIR1.CMIF = 0;
	}
}

void main() {
	TRISA = 0xFF;
	TRISB = 0x00;
	PORTB = 0x00;
	VRCON = 0xAC;
	CMCON = 0x12;
	Delay_us(10);
	PORTB.B0 = CMCON.C1OUT;
	PIR1.CMIF = 0;
	PIE1.CMIE = 1;
	INTCON.PEIE = 1;
	INTCON.GIE = 1;

	while (1) {
	}
}
