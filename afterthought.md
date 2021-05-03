# The magical journey of Dualshock 2 ~~signal sniffer~~ input overlay

> Create Date: 2021/04/29

> Warning: Bad english (yes, even worse)

Writing codes with microcontrollers is awful, as usual and expected, you need to have a brief understanding of how hardwares work with each other, maybe plus some handy tools, to plan the way your program runs, and most importantly, diagnose the problems.

Anyway, I don't want to spend more time on this project for now, even though it still have some weird unsolvable bugs left, I'm ok with that and use it as is.

## Why did I do this

I wanted to stream ps2 gameplays casualy and thought add an input overlay in my video would be very cool (way cooler than a handcam that shows you my ugly hands at least), but there's no one I could found that done it on **real console**. However, a lot of articles showed you how to use dualshock controller to control other things, which is pretty similar to what I wanted to achieve, so this must be a easy one, right?

## How did it work

As [this awesome article](https://store.curiousinventor.com/guides/PS2/) shows that everything tranferred between PS2 and a is using a standard [SPI](https://en.wikipedia.org/wiki/Serial_Peripheral_Interface) protocol, 60 times per second, we just need to capture the data and send to PC to show the result.

## Used tools and items

- DSLogic Basic (logic analyzer)  
  for signal capturing/analyzing and debuging because I'm a idiot who can only use led blinking to do diagnosis

- A broken dualshock controller  
  salvage its connector

- A cheap dualshock to usb adapter  
  salvage its connector

- Arduino pro micro (5V, 16MHz)  
  a handy little board with built-in usb

- STM32F103C8T6 (blue pill PC13)
  Pro micro's big brother, double the size, with more than twice powerful hardware

- HM-10 (bluetooth 4.0 LE module)  
  40% of the problem caused by this little shit

- CP2102 (USB to TTL adapter)  
  RIP 3.3V regulator, I don't mean to burn it, trust me

## Attempts and failures

### TL;DR

A lot of trial and error, from using GPIO interrupt to try capturing both MISO and MOSI at the same time to just using a SPI library, with problems and frustrations, but everything ended up vary well, and these are what I have learned:

- You can't use slot 2 to read data send from/to slot 1
- You can't use hardware interrupt to detect SCK signal, then capture bit from MISO/MOSI line  
  Interrupts needs time to process, and so do read data from input pin  
  But it also could be Arduino / STM32duino library's problem, thanks to all the easy-to-use API wrapping
- Arduino library is not a good tool when maximum performance or have full control over underlying hardware is required
- BLE is not good for transfer lots of data fast
- Know what it actually do before use the function call


### Attemp 0.5 - Capture signal from slot 2

1. SPI could share data lines for multiple devices, so PS2 might be this case too
2. I tested it, but all I got was some short pulses every second
3. As I measured, the data lines between slot 1 and 2 has high resistance(1k ohm IIRC)
4. Wait, I should measure it before doing all of this

### Attemp 1 - Arduino pro micro w/ external GPIO interrupt

1. I wanted to capture MISO and MOSI at once(hence a real sniffer)
2. I didn't considered SPI library yet, and thought hardware interrupt might be a good idea
3. I wrote a completed code all based on optimistic assumption, and it flopped hardly
4. Turned out Arduino library + interrupt is not fast enough to deal with 500kHz SCK signal

### Attemp 2 - Blue pill w/ external GPIO interrupt

1. I didn't want to deal with barebone c library or asm yet
2. Port everything w/ STM32duino from last attemp (like change input pin and nothing else)
3. Turned out STM32duino library + interrupt is **still** not fast enough to deal with 500kHz SCK signal
4. Fine, I'll use STM32CubeIDE instead
5. Port everything w/ STM32CubeIDE and HAL library
6. Interrupt triggered quicker, yet not have enough time to do fetch inputs and do calculation
7. Fine, I'll use SPI library

### Attemp 3 - Blue pill w/ SPI

1. Set blue pill to receive-only slave device, connected MISO line to MOSI pin to make dualshock controller acted like a master device
2. Forgot to enable interrupts
3. Interrupts worked, but the behaviour was wierd
4. Fiddled around interrupt priority
5. SPI started to capture data currectly
6. Add UART connection for HM-10
7. BLE output was not stable when controller is in analog mode w/ button pressure data
8. Found the problem was BLE speed and mtu size, truncated first byte as workaround
9. Everything started to work well, delete debug code(basically toggle led light)
10. Things broke and not worked properly
11. Revert debug code
12. Everything worked properly again
13. Why <- ~~Now here~~ not anymore

### Attemp 4 (Final) - Redo everything from attemp 3

1. Created a complete new project
2. Reconfigured every peripherals and interrupts
3. Tested every single HAL call, one line per flash
4. Found out all the problem was cause by a mix of janky codes and improper calls at wrong timing
5. Fixed them, everything works (almost) perfect now!

## Known issues

- ~~Program need to reset once after PS2 started up to run properly (could be a SPI synchronization issue or interrupt priority fuckery)~~  
  ~~It used to be fine when I set GPIO interrupt priority higher than SPI, but even then I still don't know why it cause the problem.~~  
  When PS2 started, there was a single byte of pulses sent from console, which cause a incompleted data, So:  
  Dont call HAL_SPI_Abort before CS signal pulled up  
  Dont call HAL_SPI_Abort when HAL_SPI_Receive still doing its job, also dont set receive size more than controller would sent

- ~~When PS2 restart ,SPI order of bits would be shifted and recovered after about 10~15 seconds (SPI synchronization issue)~~  
  ~~Use hardware SS/CS might help, but I'm too lazy to try that anymore~~  
  Again:  
  Dont call HAL_SPI_Abort before CS signal pulled up  
  Dont call HAL_SPI_Abort when HAL_SPI_Receive still doing its job, also dont set receive size more than controller would sent

- ~~Require unnecessary codes to run properly~~  
  ~~I used led(PC13) for debuging, but if I remove the code, the program won't run properly for whatever reason~~  
  Just the result when all the janky codes mixed together

- HM-10 BLE transfer speed and stability  
  HM-10 has fixed 20 byte MTU, so it can't fit the full 21 byte data when controller is in analog mode w/ button pressure data, but that could be solved by truncated the first byte of data, since it alway a dummy and doean't matter  
  However, when transmitting 20 byte of data each time, it seemed to throttle the connection between PC and other BLE devices (e.g. when a ble mouse is moving, the data received from HM-10 would drop to 25 times per second or even worst, alse cause lots of lag)

## Memo
- Use HAL_SPI_Abort at the end of transfer if you only going to receive part of the data, or it will raise erro and wont work next time
- Dont call HAL_SPI_Abort when HAL_SPI_Receive still doing its job, or SPI will not work
- You need to call HAL_SPI_Abort when **CS is pulled up**, or SPI will not work
- When you called HAL_SPI_Recieve_IT, SPI state should be HAL_SPI_STATE_BUSY_RX
- When HAL_SPI_RxCpltCallback been called, SPI state should be HAL_SPI_STATE_READY
