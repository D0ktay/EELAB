unsigned char sayac = 0;

void interrupt() {
	if (INTCON.INTF) {
		INTCON.INTF = 0;
		sayac++;
		PORTA = sayac;
	}
}

void main() {
	CMCON = 0x07;
	TRISA = 0x00;
	TRISB = 0x01;
	PORTA = 0x00;
	OPTION_REG.INTEDG = 1;
	INTCON.INTF = 0;
	INTCON.INTE = 1;
	INTCON.GIE = 1;

	while (1) {
	}
}
