unsigned char i;
unsigned char acilis;

void main() {
	CMCON = 0x07;
	TRISB = 0x00;
	PORTB = 0x00;

	acilis = EEPROM_Read(0x00) + 1;
	EEPROM_Write(0x00, acilis);
	Delay_ms(20);

	for (i = 1; i <= 8; i++) {
		EEPROM_Write(i, 1 << (i - 1));
		Delay_ms(20);
	}

	while (1) {
		for (i = 1; i <= 8; i++) {
			PORTB = EEPROM_Read(i);
			Delay_ms(200);
		}
		PORTB = acilis;
		Delay_ms(500);
	}
}
