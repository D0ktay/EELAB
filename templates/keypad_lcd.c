char keypadPort at PORTB;

sbit LCD_RS at RA6_bit;
sbit LCD_EN at RA7_bit;
sbit LCD_D4 at RA0_bit;
sbit LCD_D5 at RA1_bit;
sbit LCD_D6 at RA2_bit;
sbit LCD_D7 at RA3_bit;

sbit LCD_RS_Direction at TRISA6_bit;
sbit LCD_EN_Direction at TRISA7_bit;
sbit LCD_D4_Direction at TRISA0_bit;
sbit LCD_D5_Direction at TRISA1_bit;
sbit LCD_D6_Direction at TRISA2_bit;
sbit LCD_D7_Direction at TRISA3_bit;

const char tuslar[] = "789/456x123-C0=+";
unsigned char kp;

void main() {
	CMCON = 0x07;
	Keypad_Init();
	Lcd_Init();
	Lcd_Cmd(_LCD_CLEAR);
	Lcd_Cmd(_LCD_CURSOR_OFF);
	Lcd_Out(1, 1, "Tus:");

	while (1) {
		kp = Keypad_Key_Click();
		Lcd_Chr(1, 6, tuslar[kp - 1]);
	}
}
