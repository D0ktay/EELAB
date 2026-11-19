	list	p=16f628A
#include <p16F628A.inc>
	__CONFIG _INTRC_OSC_NOCLKOUT & _WDT_OFF & _PWRTE_ON & _MCLRE_OFF & _LVP_OFF

	org	0x0000
	goto	basla

basla:
	movlw	0x07
	movwf	CMCON
	banksel	TRISB
	clrf	TRISB
	banksel	PORTB
	clrf	PORTB
dongu:
	goto	dongu

	end
