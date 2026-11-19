unsigned char duty = 64;

void main() {
	CMCON = 0x07;
	TRISB = 0x00;
	PORTB = 0x00;
	PWM1_Init(5000);
	PWM1_Set_Duty(duty);
	PWM1_Start();

	while (1) {
		Delay_ms(500);
		duty = duty + 64;
		PWM1_Set_Duty(duty);
	}
}
