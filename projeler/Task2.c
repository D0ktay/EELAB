int ms10 = 0;      // 10 ms basamagi
int ms100 = 0;     // 100 ms basamagi
int sec = 0;       // 1 sn basamagi
int sec10 = 0;     // 10 sn basamagi
int sec100 = 0;    // 100 sn basamagi
int running = 0;

void main() {
	PCON.OSCF = 1;
	CMCON = 0x07;
	TRISA = 0xF0;
	TRISB = 0x00;
	PORTA = 0x00;
	PORTB = 0x00;

	while(1) {

		delay_ms(10);

		if(RA5_bit == 1) {
			running = !running;
			while(RA5_bit == 1) { }
		}

		if(RA6_bit == 1) {
			ms10 = 0;
			ms100 = 0;
			sec = 0;
			sec10 = 0;
			sec100 = 0;
		}

		if(running == 1) {
			ms10++;
			if(ms10 == 10) {
				ms10 = 0;
				ms100++;
			}
			if(ms100 == 10) {
				ms100 = 0;
				sec++;
			}
			if(sec == 10) {
				sec = 0;
				sec10++;
			}
			if(sec10 == 10) {
				sec10 = 0;
				sec100++;
			}
			if(sec100 == 10) {
				sec100 = 0;
			}
		}

		if(sec100 != 0) {
			// 100 - 999 sn : [100 sn][10 sn][1 sn]
			PORTB = (sec100 << 4) | sec10;
			PORTA = sec;
		} else if(sec10 != 0) {
			// 10.0 - 99.9 sn : [10 sn][1 sn][100 ms]
			PORTB = (sec10 << 4) | sec;
			PORTA = ms100;
		} else {
			// 0.00 - 9.99 sn : [1 sn][100 ms][10 ms]
			PORTB = (sec << 4) | ms100;
			PORTA = ms10;
		}
	}
}
