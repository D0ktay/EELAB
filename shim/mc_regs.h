typedef union { struct { unsigned B0:1; unsigned B1:1; unsigned B2:1; unsigned B3:1; unsigned B4:1; unsigned B5:1; unsigned B6:1; unsigned B7:1; }; struct { unsigned F0:1; unsigned F1:1; unsigned F2:1; unsigned F3:1; unsigned F4:1; unsigned F5:1; unsigned F6:1; unsigned F7:1; }; } mc_bits_t;
extern __at(0x0000) volatile mc_bits_t INDF_mcb;
extern __at(0x0001) volatile mc_bits_t TMR0_mcb;
extern __at(0x0002) volatile mc_bits_t PCL_mcb;
extern __at(0x0003) volatile mc_bits_t STATUS_mcb;
extern __at(0x0004) volatile mc_bits_t FSR_mcb;
extern __at(0x0005) volatile mc_bits_t PORTA_mcb;
extern __at(0x0006) volatile mc_bits_t PORTB_mcb;
extern __at(0x000A) volatile mc_bits_t PCLATH_mcb;
extern __at(0x000B) volatile mc_bits_t INTCON_mcb;
extern __at(0x000C) volatile mc_bits_t PIR1_mcb;
extern __at(0x000E) volatile mc_bits_t TMR1L_mcb;
extern __at(0x000F) volatile mc_bits_t TMR1H_mcb;
extern __at(0x0010) volatile mc_bits_t T1CON_mcb;
extern __at(0x0011) volatile mc_bits_t TMR2_mcb;
extern __at(0x0012) volatile mc_bits_t T2CON_mcb;
extern __at(0x0015) volatile mc_bits_t CCPR1L_mcb;
extern __at(0x0016) volatile mc_bits_t CCPR1H_mcb;
extern __at(0x0017) volatile mc_bits_t CCP1CON_mcb;
extern __at(0x0018) volatile mc_bits_t RCSTA_mcb;
extern __at(0x0019) volatile mc_bits_t TXREG_mcb;
extern __at(0x001A) volatile mc_bits_t RCREG_mcb;
extern __at(0x001F) volatile mc_bits_t CMCON_mcb;
extern __at(0x0081) volatile mc_bits_t OPTION_REG_mcb;
extern __at(0x0085) volatile mc_bits_t TRISA_mcb;
extern __at(0x0086) volatile mc_bits_t TRISB_mcb;
extern __at(0x008C) volatile mc_bits_t PIE1_mcb;
extern __at(0x008E) volatile mc_bits_t PCON_mcb;
extern __at(0x0092) volatile mc_bits_t PR2_mcb;
extern __at(0x0098) volatile mc_bits_t TXSTA_mcb;
extern __at(0x0099) volatile mc_bits_t SPBRG_mcb;
extern __at(0x009A) volatile mc_bits_t EEDATA_mcb;
extern __at(0x009B) volatile mc_bits_t EEADR_mcb;
extern __at(0x009C) volatile mc_bits_t EECON1_mcb;
extern __at(0x009D) volatile mc_bits_t EECON2_mcb;
extern __at(0x009F) volatile mc_bits_t VRCON_mcb;
#define C_bit STATUSbits.C
#define DC_bit STATUSbits.DC
#define Z_bit STATUSbits.Z
#define NOT_PD_bit STATUSbits.NOT_PD
#define NOT_TO_bit STATUSbits.NOT_TO
#define RP0_bit STATUSbits.RP0
#define RP1_bit STATUSbits.RP1
#define IRP_bit STATUSbits.IRP
#define RA0_bit PORTAbits.RA0
#define RA1_bit PORTAbits.RA1
#define RA2_bit PORTAbits.RA2
#define RA3_bit PORTAbits.RA3
#define RA4_bit PORTAbits.RA4
#define RA5_bit PORTAbits.RA5
#define RA6_bit PORTAbits.RA6
#define RA7_bit PORTAbits.RA7
#define RB0_bit PORTBbits.RB0
#define RB1_bit PORTBbits.RB1
#define RB2_bit PORTBbits.RB2
#define RB3_bit PORTBbits.RB3
#define RB4_bit PORTBbits.RB4
#define RB5_bit PORTBbits.RB5
#define RB6_bit PORTBbits.RB6
#define RB7_bit PORTBbits.RB7
#define RBIF_bit INTCONbits.RBIF
#define INTF_bit INTCONbits.INTF
#define T0IF_bit INTCONbits.T0IF
#define RBIE_bit INTCONbits.RBIE
#define INTE_bit INTCONbits.INTE
#define T0IE_bit INTCONbits.T0IE
#define PEIE_bit INTCONbits.PEIE
#define GIE_bit INTCONbits.GIE
#define TMR0IF_bit INTCONbits.TMR0IF
#define TMR0IE_bit INTCONbits.TMR0IE
#define TMR1IF_bit PIR1bits.TMR1IF
#define TMR2IF_bit PIR1bits.TMR2IF
#define CCP1IF_bit PIR1bits.CCP1IF
#define TXIF_bit PIR1bits.TXIF
#define RCIF_bit PIR1bits.RCIF
#define CMIF_bit PIR1bits.CMIF
#define EEIF_bit PIR1bits.EEIF
#define TMR1ON_bit T1CONbits.TMR1ON
#define TMR1CS_bit T1CONbits.TMR1CS
#define NOT_T1SYNC_bit T1CONbits.NOT_T1SYNC
#define T1OSCEN_bit T1CONbits.T1OSCEN
#define T1CKPS0_bit T1CONbits.T1CKPS0
#define T1CKPS1_bit T1CONbits.T1CKPS1
#define T2CKPS0_bit T2CONbits.T2CKPS0
#define T2CKPS1_bit T2CONbits.T2CKPS1
#define TMR2ON_bit T2CONbits.TMR2ON
#define TOUTPS0_bit T2CONbits.TOUTPS0
#define TOUTPS1_bit T2CONbits.TOUTPS1
#define TOUTPS2_bit T2CONbits.TOUTPS2
#define TOUTPS3_bit T2CONbits.TOUTPS3
#define CCP1M0_bit CCP1CONbits.CCP1M0
#define CCP1M1_bit CCP1CONbits.CCP1M1
#define CCP1M2_bit CCP1CONbits.CCP1M2
#define CCP1M3_bit CCP1CONbits.CCP1M3
#define CCP1Y_bit CCP1CONbits.CCP1Y
#define CCP1X_bit CCP1CONbits.CCP1X
#define RX9D_bit RCSTAbits.RX9D
#define OERR_bit RCSTAbits.OERR
#define FERR_bit RCSTAbits.FERR
#define ADEN_bit RCSTAbits.ADEN
#define CREN_bit RCSTAbits.CREN
#define SREN_bit RCSTAbits.SREN
#define RX9_bit RCSTAbits.RX9
#define SPEN_bit RCSTAbits.SPEN
#define ADDEN_bit RCSTAbits.ADDEN
#define CM0_bit CMCONbits.CM0
#define CM1_bit CMCONbits.CM1
#define CM2_bit CMCONbits.CM2
#define CIS_bit CMCONbits.CIS
#define C1INV_bit CMCONbits.C1INV
#define C2INV_bit CMCONbits.C2INV
#define C1OUT_bit CMCONbits.C1OUT
#define C2OUT_bit CMCONbits.C2OUT
#define PS0_bit OPTION_REGbits.PS0
#define PS1_bit OPTION_REGbits.PS1
#define PS2_bit OPTION_REGbits.PS2
#define PSA_bit OPTION_REGbits.PSA
#define T0SE_bit OPTION_REGbits.T0SE
#define T0CS_bit OPTION_REGbits.T0CS
#define INTEDG_bit OPTION_REGbits.INTEDG
#define NOT_RBPU_bit OPTION_REGbits.NOT_RBPU
#define TRISA0_bit TRISAbits.TRISA0
#define TRISA1_bit TRISAbits.TRISA1
#define TRISA2_bit TRISAbits.TRISA2
#define TRISA3_bit TRISAbits.TRISA3
#define TRISA4_bit TRISAbits.TRISA4
#define TRISA5_bit TRISAbits.TRISA5
#define TRISA6_bit TRISAbits.TRISA6
#define TRISA7_bit TRISAbits.TRISA7
#define TRISB0_bit TRISBbits.TRISB0
#define TRISB1_bit TRISBbits.TRISB1
#define TRISB2_bit TRISBbits.TRISB2
#define TRISB3_bit TRISBbits.TRISB3
#define TRISB4_bit TRISBbits.TRISB4
#define TRISB5_bit TRISBbits.TRISB5
#define TRISB6_bit TRISBbits.TRISB6
#define TRISB7_bit TRISBbits.TRISB7
#define TMR1IE_bit PIE1bits.TMR1IE
#define TMR2IE_bit PIE1bits.TMR2IE
#define CCP1IE_bit PIE1bits.CCP1IE
#define TXIE_bit PIE1bits.TXIE
#define RCIE_bit PIE1bits.RCIE
#define CMIE_bit PIE1bits.CMIE
#define EEIE_bit PIE1bits.EEIE
#define NOT_BOR_bit PCONbits.NOT_BOR
#define NOT_POR_bit PCONbits.NOT_POR
#define OSCF_bit PCONbits.OSCF
#define NOT_BO_bit PCONbits.NOT_BO
#define NOT_BOD_bit PCONbits.NOT_BOD
#define TX9D_bit TXSTAbits.TX9D
#define TRMT_bit TXSTAbits.TRMT
#define BRGH_bit TXSTAbits.BRGH
#define SYNC_bit TXSTAbits.SYNC
#define TXEN_bit TXSTAbits.TXEN
#define TX9_bit TXSTAbits.TX9
#define CSRC_bit TXSTAbits.CSRC
#define RD_bit EECON1bits.RD
#define WR_bit EECON1bits.WR
#define WREN_bit EECON1bits.WREN
#define WRERR_bit EECON1bits.WRERR
#define VR0_bit VRCONbits.VR0
#define VR1_bit VRCONbits.VR1
#define VR2_bit VRCONbits.VR2
#define VR3_bit VRCONbits.VR3
#define VRR_bit VRCONbits.VRR
#define VROE_bit VRCONbits.VROE
#define VREN_bit VRCONbits.VREN
enum { NOT_PD = 3, NOT_TO = 4, RP0 = 5, RP1 = 6, IRP = 7, RA0 = 0, RA1 = 1, RA2 = 2, RA3 = 3, RA4 = 4, RA5 = 5, RA6 = 6, RA7 = 7, RB0 = 0, RB1 = 1, RB2 = 2, RB3 = 3, RB4 = 4, RB5 = 5, RB6 = 6, RB7 = 7, RBIF = 0, INTF = 1, T0IF = 2, RBIE = 3, INTE = 4, T0IE = 5, PEIE = 6, GIE = 7, TMR0IF = 2, TMR0IE = 5, TMR1IF = 0, TMR2IF = 1, CCP1IF = 2, TXIF = 4, RCIF = 5, CMIF = 6, EEIF = 7, TMR1ON = 0, TMR1CS = 1, NOT_T1SYNC = 2, T1OSCEN = 3, T1CKPS0 = 4, T1CKPS1 = 5, T2CKPS0 = 0, T2CKPS1 = 1, TMR2ON = 2, TOUTPS0 = 3, TOUTPS1 = 4, TOUTPS2 = 5, TOUTPS3 = 6, CCP1M0 = 0, CCP1M1 = 1, CCP1M2 = 2, CCP1M3 = 3, CCP1Y = 4, CCP1X = 5, RX9D = 0, OERR = 1, FERR = 2, ADEN = 3, CREN = 4, SREN = 5, RX9 = 6, SPEN = 7, ADDEN = 3, CM0 = 0, CM1 = 1, CM2 = 2, CIS = 3, C1INV = 4, C2INV = 5, C1OUT = 6, C2OUT = 7, PS0 = 0, PS1 = 1, PS2 = 2, PSA = 3, T0SE = 4, T0CS = 5, INTEDG = 6, NOT_RBPU = 7, TRISA0 = 0, TRISA1 = 1, TRISA2 = 2, TRISA3 = 3, TRISA4 = 4, TRISA5 = 5, TRISA6 = 6, TRISA7 = 7, TRISB0 = 0, TRISB1 = 1, TRISB2 = 2, TRISB3 = 3, TRISB4 = 4, TRISB5 = 5, TRISB6 = 6, TRISB7 = 7, TMR1IE = 0, TMR2IE = 1, CCP1IE = 2, TXIE = 4, RCIE = 5, CMIE = 6, EEIE = 7, NOT_BOR = 0, NOT_POR = 1, OSCF = 3, NOT_BO = 0, NOT_BOD = 0, TX9D = 0, TRMT = 1, BRGH = 2, SYNC = 4, TXEN = 5, TX9 = 6, CSRC = 7, WREN = 2, WRERR = 3, VR0 = 0, VR1 = 1, VR2 = 2, VR3 = 3, VRR = 5, VROE = 6, VREN = 7 };
