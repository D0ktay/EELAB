	list	p=16f628A
#include <p16F628A.inc>
	__CONFIG _INTRC_OSC_NOCLKOUT & _WDT_OFF & _PWRTE_ON & _MCLRE_OFF & _LVP_OFF

sayac	EQU	0x20
d1	EQU	0x21
d2	EQU	0x22

	org	0x0000
	goto	basla

basla:
	movlw	0x07
	movwf	CMCON
	banksel	TRISB
	clrf	TRISB
	banksel	PORTB
	clrf	sayac
dongu:
	movf	sayac, w
	movwf	PORTB
	call	bekle
	incf	sayac, f
	goto	dongu

bekle:
	movlw	.200
	movwf	d1
bekle1:
	movlw	.250
	movwf	d2
bekle2:
	nop
	decfsz	d2, f
	goto	bekle2
	decfsz	d1, f
	goto	bekle1
	return

	end
