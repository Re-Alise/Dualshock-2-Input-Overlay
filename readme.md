# Dualshock 2 Input Overlay

https://user-images.githubusercontent.com/28112294/116925382-16a54800-ac94-11eb-88cc-4161dd47b48d.mp4
> The video do not play here somehow, just download it or the file in the repo

## Precaution

- Very nasty/janky code inside, prepare your eyebleach(TM)

- Soldering required to connect and remove some wire on the connectors, make sure **nothing is shorted** before connect to the console.

- Don't connect anything to your PS2 before both program and wiring are done

- Always check the wiring

- The overlay work fine to me, but you might have to modified the code to fit your need.

- Read carefully and take your own risk if you decide to proceed, I don't take responsibility for anything you did, included but not limited to:
  - Burn yourself
  - Fry your PS2
  - Regret no to see Q&A first
  - Eat pizza at 4:00AM
  - Lost interest to any kind of cat

Everything's still OK? Let's move on

## What is it

![Sniffer overview (ugly/nasty I know, but it works!)](/images/sniffer-overview.png)

A realtime input overlay that capture and show the input from the dualshock 2 controller that is `connected to a running PS2 console`, whitch:

- Can capture and display the input from the controller connected to a PS2 console realtime
- Auto detect and display dualshock 2's three modes: digital, analog and analog w/ button pressure
- Idk but it I think it's cool to use on stream

## How it work

![Signal captured in digital mode](/images/dsview-digital.png)

As [this awesome article](https://store.curiousinventor.com/guides/PS2/) shows that everything tranferred between PS2 and a is using a standard [SPI](https://en.wikipedia.org/wiki/Serial_Peripheral_Interface) protocol, 60 times per second.

So I capture the data using `STM32F103C8T6 aka blue pill` and send to PC to show the result on web page.

For anyone want to see the actual signal, I put some examples in `singal records` folder, you could open them with [DSView](https://www.dreamsourcelab.com/download/)

## What you need

- A way to connect to a attach wires on MISO/SCK/CS/GND/~~3.3V~~ line of your controller when PS2 is running  
  If you conveniently have a broken dualshock controller and a cheap dualshock to usb adapter, you can build a bypass connector like this:
  ![](/images/bypass-connector-alpha.png)

- STM32F103C8T6 (blue pill) x 1  
  Could be other stm32 devices if you compile it from code

- A USB to TTL adapter or ~~ST-Link if you already have one~~  
  Just to flash program to blue pill 

- A bluetooth 4.0/5.0 LE module (optional, not recommended)
  HM-10 is OK-ish if you don't care the laggy result, but use better one if possible  
  Maybe try one with EDR or HS to potential stability, if you're ok with modify `dualshock.js` a little

- A PC that have usb or bluetooth connectivity (optional), alse capable of running chrome and javascript  
  Where else would you want it running on (jk  
  Other connection method also possible (like make it a USB HID gamepad), if you willing to challenge yourself 

## Flash the program

First, connect your USB to TTL adapter to your blue pill:

1. Adapter's `GND` to blue pill's `GND`
1. Adapter's `3.3V` to blue pill's `3.3V`  
   Or adapter's `5V` to blue pill's `5V`, but don't use both  
1. Adapter's `Rx` to blue pill's `A9`
1. Adapter's `Tx` to blue pill's `A10`
1. Set the jumper on `BOOT0` to `1`, or it won't be recognized by flash loader

After that, download [STM32 Flash loader demonstrator](https://www.st.com/en/development-tools/flasher-stm32.html) and install it, then:
1. Plug your USB to TTL adapter to your PC
1. Open the flash loader (should be named `Demonstrator GUI` in start menu)
1. Select the COM port of your adapter
1. Click next until option `Download to device` appears
1. Choose `ds2_overlay.hex` in the repo
1. Click next and let the program flash to blue pill
1. Set the jumper on `BOOT0` back to `0`, or it won't run the program

> If flash loader don't recognize your blue pill, try swap the adapter's Rx and Tx pin, because some manufactures sucks

## Wiring

![Wires of a dualshock controller (sorry dark theme user, I tried my best)](/images/ds2-wires.png)

The picture above shows the wires inside a dualshock connector (pictured from top of the it, notice the dents), all we need here is `MISO, GND, CS and CLK`.

Connect these wires to STM32F103C8T6 (blue pill) as following:
1. `GND` to `GND`
1. `MISO` to `A7`
1. `CLK` to `A5`
1. `CS` to `A4` and `A3`  
  Yes, two pins, one for SPI communication, one for interrupt, just use a jump wire between them

> Don't solder anything *directly* to your controller, buy a cheap thirdparty one (or a broken one) and a USB adapter to build a bypass connector


## Use the Overlay

![A preview of overlay, yes, that's what it look, ugly yet functional enough](/images/overlay-preview.png)
After all the hard work, you should be able to use the overlay!

To use it, you can:

- Place `index.html`, `dualshock.js` and the `.svg` file you want to use on your web sever.

- Simply use `index-local.html` instead to use it locally

The only difference is `index-local.html` use inline svg that you have to copy and paste the svg's content *manualy* under `#dualshock` in html file when you want to change to image

By now, you have two ways to connect your blue pill:
- Connect via USB (stable)
- Connect via Bluetooth LE (unstable, not recommended)

In either way, if your web browser do not support the feature (like firefox or any other non-chromium-based browser), it will notice you by the bottom left text

> At this point, check the wiring one last time

Final step, connect blue pill to PC, click the button, turn on your PS2 and enjoy!

## Customize

If you don't mind the janky code, there's two things you can change in the overlay: SVG image and the color

### SVG image

> Would be easier to use software like Affinity Design or Photoshop that support SVG import / export

> I already created two versions of image: compact (cleaner, no text, smaller size) and no_symbols (include select/start/analog text, larger size) with black and white variant, I ditched the with_symbol version in case some copyright issue happen

Because I have no skill to make scalable image animation (yet), every here is performed by *change the object's style string frame by frame by querySelect()*, hense you can make your own svg image that conform the following:

- Have all the ID to be manipulated  
  ```
  // Controls
  #AnalogLedLight 
  #SelectButton
  #StartButton

  // Analog sticks
  #LeftStick
  #RightStick

  // Arrows
  #UpArrow
  #RightArrow
  #DownArrow
  #LeftArrow

  // L1/L2, R1/R2
  #LeftShoulder
  #RightShoulder
  
  // Buttons
  #TriangleButton
  #CircleButton
  #CrossButton
  #SquareButton
  ```

- `#LeftStick` and `#RightStick` must be `<circle>` element
- `#LeftStick` and `#RightStick` use filling color to indicate X3's state
- `#LeftShoulder` and `#RightShoulder` use filling color to indicate X1's state, and stroke color to indecate X2's state

Or, of course, just modify the code to fit your need (which would be much faster and simpler I think).

### Color

Since SVG image and the other thing are separate parts, you need to set the color you want to use in `dualshock.js`:

- backgroundColor, backgroundColorString  
  Color of background

- defaultColor, defaultColorString  
  Button color when not be pressed

- highlightColor, highlightColorString
  Button color when be pressed

- disabledColor
  Analog stick color when controller is in digital mode

Each color is an array, which could contain 3 (rgb) or 4 (rgba) element, and each colorString is a css color string (like `black`, `rgb(252, 175, 22)` or `rgba(255, 255, 255, 0.1)`)

> Why have I set every color twice in differnt format

Because I'm too lazy to convert them back and forth, but you can make it better

## Q&A

### Can I use it in OBS

Yes, you can, with a little extra step  
First, you need to use `window capture` instead of `browser source`, since OBS's built-in browser don't support serial connection, also don't display popup window, which is required to set up both connection.

Second, change the background color in `dualshock.js` to match your setup, since `window capture` can't set transparent background, and that's it!

### How do I know it is working

If the LED on PC13 is blinking (very fast, like 30 time per second), then it is working.  

Notice that when PS2 is just starting up, or the game is in loading screen, you'll not receive any data since PS2 is not asking any control signal then.

### How do I Compile program myself

For `STM32F103C8T6`, you can use [STM32CubeIDE](https://www.st.com/en/development-tools/stm32cubeide.html) to create new project from existing configuration file, select `ds2_overlay/ds2_overlay.ioc` to set the peripheral and clock for you, then copy `ds2_overlay/main.c` to your project, click `Build All` and it should be something in your workspace's `/Debug` folder

For other STM32 board, just use [STM32CubeIDE] and set your board type and peripheral manually, then copy `ds2_overlay/main.c` to your project and correct the name of `*hspiX` and `*huartX` before click `Build All`.

### Can the program be used on arduino

No, you can not use it *directly* on arduino board, but you might be able to port it!
I did try using Arduino Pro Micro without seccess, but the task is simple and should be able to handled by it:

- Receive SPI data with 4~21 byte length w/ 250kHz or 500kHz CLK frequency
- Do some basic error checking and pass it to PC
- Repeat

### Can it be used in reversed way, like an emulated dualshock

No, it can't, at least for now.  
Emulate a dualshock controller needs a little more work to get it done right, like handling the ACK signal and config mode (0xF3) that I did not know how it fully work yet, but once figured out, it would be a fun little device to play with (like test TAS strats in real console, DIY dualshock wireless controller, or just prank someone that my PS2 is haunted).

### When using w/ BLE, overlay semms laggy from time to time

Since BLE is not designed to transfer such large amount of data continuously, it do not handle well if you're using other BLE devices(wireless mouse, keyboard, etc.). In my case (HM-10) it is very unstable (smooth at first 10 second, then drop down to 10~30 package per second with huge amount of lags) but YMMV.

To mitigate this, I purposely truncated the pressure data for analog mode, but it still laggy sometime  
Modify the js code to support EDR/HS would be a choice, in this case, try connect PB9 on blue pill to GND to force it output pressure data when available

### Why all button inputs lights up when swith from digital mode and analog mode

I don't know the actual reason, but it could be some confusing signal flying around when swith the mode, or just my bad code not handle the transition well.

### The overlay doesn't work

- Check your browser is chromium-based, like Chrome or Edge (the new one)
- Check if your blue pill is powered by PC or PS2
- Check if you're using the wrong `index.html`, use `index-local.html` for local use  
  This is a stupid one, ~~I don't know why web browser see local file as cross-origin and strict to access to external svg's contentDocument~~ I see the reason there, but it still annoyed me.
- Press `F12` in the browser to see if any error in console tab

### My PS2 broke because of this XXXX thing

- Read the precaution
- Unplug everything and check the wiring again, is anything shorted?
- Eat some chocolate, you tried your best and learnt a lot, it'll make you feel better

## Extra/Reference/Credits?

- [CuriousInventor](https://store.curiousinventor.com/) - Without the article, I cant made it so fast

- [Dimensions.com](https://www.dimensions.com/) - For the dualshock 2 svg I modified from

- [munia](https://github.com/zzattack/munia) - A similar project that I didn't know until I was writting this
