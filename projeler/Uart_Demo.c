unsigned char c;

void main() {
	CMCON = 0x07;
	UART1_Init(9600);
	Delay_ms(100);
	UART1_Write_Text("EE321 UART\r\n");

	while (1) {
		if (UART1_Data_Ready()) {
			c = UART1_Read();
			UART1_Write(c);
		}
	}
}
