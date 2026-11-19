/* mikroC PRO for PIC uyumluluk katmani (SDCC, PIC16F628A) */
#ifndef MC_FOSC
#define MC_FOSC 4000000UL
#endif
#define NO_BIT_DEFINES
#include <pic16f628a.h>
#include "mc_regs.h"

#if defined(MC_CONFIG)
__code unsigned int __at(_CONFIG) mc_config_word = MC_CONFIG;
#elif MC_FOSC <= 4000000UL
__code unsigned int __at(_CONFIG) mc_config_word =
    _INTOSC_OSC_NOCLKOUT & _WDT_OFF & _PWRTE_ON & _MCLRE_OFF &
    _BOREN_OFF & _LVP_OFF & _CPD_OFF & _CP_OFF;
#else
__code unsigned int __at(_CONFIG) mc_config_word =
    _HS_OSC & _WDT_OFF & _PWRTE_ON & _MCLRE_OFF &
    _BOREN_OFF & _LVP_OFF & _CPD_OFF & _CP_OFF;
#endif

#define MC_VB(x) (*(volatile mc_bits_t *)&(x))
#define Lo(x) ((unsigned char)((x) & 0xFF))
#define Hi(x) ((unsigned char)(((x) >> 8) & 0xFF))
#define Higher(x) ((unsigned char)(((unsigned long)(x) >> 16) & 0xFF))
#define Highest(x) ((unsigned char)(((unsigned long)(x) >> 24) & 0xFF))
#define Swap(x) ((unsigned char)((((x) & 0x0F) << 4) | (((x) >> 4) & 0x0F)))
#define Clock_kHz() (MC_FOSC / 1000UL)
#define Clock_MHz() (MC_FOSC / 1000000UL)

#define MC_US_A 17UL
#define MC_US_B 10UL
#define MC_CYC_K(c) ((unsigned int)(((unsigned long)(c) > MC_US_A) ? (((unsigned long)(c) - MC_US_A) / MC_US_B) : 0))
#define MC_US_K(n) MC_CYC_K((unsigned long)(n) * (MC_FOSC / 1000000UL) / 4UL)
void mc_delay_ms(unsigned int n);
void mc_delay_k(unsigned int k);
#define delay_ms(n) mc_delay_ms(n)
#define Delay_ms(n) mc_delay_ms(n)
#define Vdelay_ms(n) mc_delay_ms(n)
#define VDelay_ms(n) mc_delay_ms(n)
#define Delay_us(n) mc_delay_k(MC_US_K(n))
#define delay_us(n) mc_delay_k(MC_US_K(n))
#define Delay_Cyc(n) mc_delay_k(MC_CYC_K((unsigned long)(n) * 10UL))
#define Delay_1us() Delay_us(1)
#define Delay_5us() Delay_us(5)
#define Delay_10us() Delay_us(10)
#define Delay_22us() Delay_us(22)
#define Delay_50us() Delay_us(50)
#define Delay_80us() Delay_us(80)
#define Delay_500us() Delay_us(500)
#define Delay_5500us() Delay_us(5500)
#define Delay_1ms() mc_delay_ms(1)
#define Delay_5ms() mc_delay_ms(5)
#define Delay_8ms() mc_delay_ms(8)
#define Delay_10ms() mc_delay_ms(10)
#define Delay_100ms() mc_delay_ms(100)
#define Delay_1sec() mc_delay_ms(1000)

unsigned char Button(unsigned char *port, unsigned char pin, unsigned char time, unsigned char active_state);

#define _LCD_FIRST_ROW 128
#define _LCD_SECOND_ROW 192
#define _LCD_THIRD_ROW 148
#define _LCD_FOURTH_ROW 212
#define _LCD_CLEAR 1
#define _LCD_RETURN_HOME 2
#define _LCD_CURSOR_OFF 12
#define _LCD_UNDERLINE_ON 14
#define _LCD_BLINK_CURSOR_ON 15
#define _LCD_MOVE_CURSOR_LEFT 16
#define _LCD_MOVE_CURSOR_RIGHT 20
#define _LCD_TURN_ON 12
#define _LCD_TURN_OFF 8
#define _LCD_SHIFT_LEFT 24
#define _LCD_SHIFT_RIGHT 28
void Lcd_Init(void);
void Lcd_Cmd(unsigned char out_char);
void Lcd_Chr_Cp(unsigned char out_char);
void Lcd_Chr(unsigned char row, unsigned char column, unsigned char out_char);
void Lcd_Out_Cp(char *text);
void Lcd_Out(unsigned char row, unsigned char column, char *text);

void Keypad_Init(void);
unsigned char Keypad_Key_Press(void);
unsigned char Keypad_Key_Click(void);

#define MC_BRGH(b) ((MC_FOSC / (16UL * (unsigned long)(b))) <= 256UL ? 1 : 0)
#define MC_SPBRG(b) ((unsigned char)(MC_BRGH(b) ? ((MC_FOSC + 8UL * (unsigned long)(b)) / (16UL * (unsigned long)(b)) - 1UL) : ((MC_FOSC + 32UL * (unsigned long)(b)) / (64UL * (unsigned long)(b)) - 1UL)))
#define UART1_Init(b) mc_uart_init(MC_SPBRG(b), MC_BRGH(b))
#define UART_Init(b) mc_uart_init(MC_SPBRG(b), MC_BRGH(b))
void mc_uart_init(unsigned char spbrg, unsigned char brgh);
void UART1_Write(unsigned char data_);
unsigned char UART1_Read(void);
unsigned char UART1_Data_Ready(void);
unsigned char UART1_Tx_Idle(void);
void UART1_Write_Text(char *uart_text);
void UART1_Read_Text(char *output, char *delimiter, unsigned char attempts);
#define UART_Write UART1_Write
#define UART_Read UART1_Read
#define UART_Data_Ready UART1_Data_Ready
#define UART_Tx_Idle UART1_Tx_Idle
#define UART_Write_Text UART1_Write_Text
#define UART_Read_Text UART1_Read_Text

#define MC_PWMX(f, p) (MC_FOSC / (4UL * (unsigned long)(f) * (p)))
#define MC_T2CK(f) (MC_PWMX(f, 1UL) <= 256UL ? 0 : MC_PWMX(f, 4UL) <= 256UL ? 1 : 2)
#define MC_PR2(f) ((unsigned char)((MC_T2CK(f) == 0 ? MC_PWMX(f, 1UL) : MC_T2CK(f) == 1 ? MC_PWMX(f, 4UL) : MC_PWMX(f, 16UL)) - 1UL))
#define PWM1_Init(f) mc_pwm_init(MC_PR2(f), MC_T2CK(f))
void mc_pwm_init(unsigned char pr2, unsigned char ck);
void PWM1_Set_Duty(unsigned char duty_ratio);
void PWM1_Start(void);
void PWM1_Stop(void);

unsigned char EEPROM_Read(unsigned char address);
void EEPROM_Write(unsigned char address, unsigned char data_);

void ByteToStr(unsigned char input, char *output);
void ShortToStr(signed char input, char *output);
void WordToStr(unsigned int input, char *output);
void IntToStr(int input, char *output);
void LongToStr(long input, char *output);
void LongWordToStr(unsigned long input, char *output);
void ByteToHex(unsigned char input, char *output);
void ShortToHex(signed char input, char *output);
void WordToHex(unsigned int input, char *output);
void IntToHex(int input, char *output);
void ByteToStrWithZeros(unsigned char input, char *output);
void ShortToStrWithZeros(signed char input, char *output);
void WordToStrWithZeros(unsigned int input, char *output);
void IntToStrWithZeros(int input, char *output);
unsigned char Bcd2Dec(unsigned char bcdnum);
unsigned char Dec2Bcd(unsigned char decnum);

void Sound_Init(unsigned char *snd_port, unsigned char snd_pin);
void Sound_Play(unsigned int freq_in_hz, unsigned int duration_ms);
