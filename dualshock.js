// "Positive Yellow" from Ridge Racer Type 4
// Cyan 0% Magenta 35% Yellow 100% Black 0%
// => rgb(252, 175, 22)

const readmeString = `Hello, fellow visitor,
this is a dualshock 2 overlay that show realtime input of real console (additinal hardware required)

Go check out my github repo for detail: TBD soon

ps. The svg image used here is modified from Dimensions.com
`

// Colors for overlay
const backgroundColorString = 'black'
const backgroundColor = [0, 0, 0]
// const backgroundColorString = 'rgb(244, 181, 0)'
// const backgroundColor = [244, 181, 0]
const positiveYellow = [252, 175, 22]
const positiveYellowString = 'rgba(252, 175, 22, 1)'

const defaultColor = [255, 255, 255]
const defaultColorString = 'white'
// const defaultColor = [0, 0, 0, 0.2]
// const defaultColorString = 'rgba(0, 0, 0, 0.2)'

const highlightColor = positiveYellow
const highlightColorString = positiveYellowString
// const highlightColor = [0, 0, 0]
// const highlightColorString = 'black'

const disabledColor = 'rgba(255, 255, 255, 0.1)'
// const disabledColor = 'rgba(0, 0, 0, 0.2)'

// blend two colors in an unnecessarily complex way
function blendColor (color1, color2, f, stringify = false) {
  const resultColor = [0, 0, 0, 0]
  resultColor[0] = Math.floor(Math.sqrt((color1[0] ** 2) * f + (color2[0] ** 2) * (1 - f)))
  resultColor[1] = Math.floor(Math.sqrt((color1[1] ** 2) * f + (color2[1] ** 2) * (1 - f)))
  resultColor[2] = Math.floor(Math.sqrt((color1[2] ** 2) * f + (color2[2] ** 2) * (1 - f)))
  if (color1.length === 4 || color2.length === 4) {
    resultColor[3] = ((color1.length > 3) ? color1[3] : 1) * f + ((color2.length > 3) ? color2[3] : 1) * (1 - f)
  }

  if (stringify) {
    if (color1.length === 4 || color2.length === 4) {
      return `rgba(${resultColor[0]}, ${resultColor[1]}, ${resultColor[2]}, ${resultColor[3]})`
    } else {
      return `rgb(${resultColor[0]}, ${resultColor[1]}, ${resultColor[2]})`
    }
  } else {
    return resultColor
  }
}

// An quick and dirty way to change element style in external svg image
function changeStyle (element, property, value) {
  const re = RegExp(`${property}\\:([\\w,\\(\\) \\.]+)\\;`)
  element.setAttribute('style', element.getAttribute('style').replace(re, `${property}:${value};`))
}

// Configs for BLE
let serialCharacteristic
// The sevice ID to transfer serial data, Change the value to what your device set
const TargetService = parseInt('0xffe0')
// The characteristic ID to transfer serial data ,change the value to what your device set
const TargetCharacteristic = parseInt('0xffe1')

const option = {}
const filter = {}
filter.services = [TargetService]
option.filters = [filter]

// Parts to control in svg image
let dsControls
let dsSticks
let dsArrows
let dsShoulders
let dsButtons
// let dsAnalog
let dsAnalogLed
let dsLeftStickCenter
let dsRightStickCenter

// Debug things
let dataCount = 0
let testInterval
let statusString

// Anolog stick deadzone to make output looks pretty, or it will move in a square-ish area
const deadzoneFactor = 1.118
const deadzoneRadius = 128 * deadzoneFactor

//
let keepReading = true
let reader

// Init function, check connectivity and set variables for svg
function init () {
  console.log("OwO What's This!?\n-Re:Alise, 2021")
  console.log(readmeString)
  document.body.style.background = backgroundColorString
  initConnection()
  initDs2ButtonMap()
}

// Get every parts needed in svg
function initDs2ButtonMap () {
  let dualshock = document.querySelector('#dualshock').contentDocument
  if (dualshock === null) {
    console.log('[Warning] Can not get content document in #dualshock, are you using inline svg?')
    dualshock = document
  }

  // dsAnalog = dualshock.querySelector('#AnalogButton')
  dsAnalogLed = dualshock.querySelector('#AnalogLedLight')

  dsControls = [
    dualshock.querySelector('#SelectButton'),
    dualshock.querySelector('#StartButton')
  ]

  dsSticks = [
    dualshock.querySelector('#LeftStick'),
    dualshock.querySelector('#RightStick')
  ]

  dsArrows = [
    dualshock.querySelector('#UpArrow'),
    dualshock.querySelector('#RightArrow'),
    dualshock.querySelector('#DownArrow'),
    dualshock.querySelector('#LeftArrow')
  ]

  dsShoulders = [
    dualshock.querySelector('#LeftShoulder'),
    dualshock.querySelector('#RightShoulder')
  ]

  dsButtons = [
    dualshock.querySelector('#TriangleButton'),
    dualshock.querySelector('#CircleButton'),
    dualshock.querySelector('#CrossButton'),
    dualshock.querySelector('#SquareButton')
  ]

  // Get position of analog sticks
  dsLeftStickCenter = [parseInt(dsSticks[0].getAttribute('cx')), parseInt(dsSticks[0].getAttribute('cy'))]
  dsRightStickCenter = [parseInt(dsSticks[1].getAttribute('cx')), parseInt(dsSticks[1].getAttribute('cy'))]
}

// Check if BLE or serial connection is available
function initConnection () {
  let status = 0
  statusString = document.querySelector('#status')

  if (!('bluetooth' in navigator)) {
    status += 1
  }
  if (!('serial' in navigator)) {
    status += 2
  }

  switch (status) {
    case 0:
      statusString.textContent = 'Status: Everything seems fine :)'
      // setSerialListener()
      break
    case 1:
      statusString.textContent = 'Status: [Warning] This browser do not support BLE connection'
      // Hide BLE buttons
      document.querySelector('#ble-buttons').style.display = 'none'
      // setSerialListener()
      break
    case 2:
      statusString.textContent = 'Status: [Warning] This browser do not support serial connection'
      // Hide serial buttons
      document.querySelector('#serial-buttons').style.display = 'none'
      break
    case 3:
      statusString.textContent = 'Status: [Error] This browser do not support both BLE and serial connection'
      break
  }
}

// Connect to BLE device and get notifications
function connectBle () {
  let targetDevice = navigator.bluetooth.requestDevice(option)
  targetDevice.then(device => {
    console.log('Device connected:', device.name)
    targetDevice = device
    console.log(1)
    return device.gatt.connect()
  }).then(server => {
    console.log(2)
    return server.getPrimaryService(TargetService)
  }).then(service => {
    console.log(3)
    return service.getCharacteristic(TargetCharacteristic)
  }).then(characteristic => {
    console.log(4)
    return characteristic.startNotifications().then(_ => {
      serialCharacteristic = characteristic
      // Add listener to process notification data
      serialCharacteristic.addEventListener('characteristicvaluechanged', updateSvgBle)
      testInterval = setInterval(tick, 1000)
    })
  }).catch(error => {
    console.log('BLE error' + error)
  })
}

// Stop notification and remove listener
function stopBleNotification () {
  if (testInterval) {
    clearInterval(testInterval)
  }
  if (serialCharacteristic) {
    serialCharacteristic.stopNotifications().then(_ => {
      console.log('> Notifications stopped')
      serialCharacteristic.removeEventListener('characteristicvaluechanged',
        updateSvgBle)
    }).catch(error => {
      console.log('BLE stop notification error: ' + error)
    })
  }
}

// [Unused] Print currently connected **paired** serial devices in console
async function showSerialPorts () {
  const ports = await navigator.serial.getPorts()
  if (ports.length > 0) {
    for (const port of ports) {
      console.log('Port info:', port.getInfo())
    }
  } else {
    console.log('No port')
  }
}

// [Unused] Add listener when paired serial device connected/disconnected
function setSerialListener () {
  navigator.serial.addEventListener('connect', e => {
    // Add |e.port| to the UI or automatically connect.
    console.log('New serial port: ', e.srcElement.getInfo())
    // statusString.textContent = e.srcElement.getInfo()['usbProductId']
    testPort.push(e.srcElement)
    console.log('Current ports: ' + testPort)
  })

  navigator.serial.addEventListener('disconnect', e => {
    // Remove |e.port| from the UI. If the device was open the
    // disconnection can also be observed as a stream error.
    console.log('Serial disconnected: ', e.srcElement.getInfo())
    testPort.splice(testPort.indexOf(e.srcElement), 1)
    console.log('Current ports: ' + testPort)
  })
}

// Connect to serial device and update svg color
async function connectSerial () {
  const port = await navigator.serial.requestPort()
  let dataTemp = []
  await port.open({ baudRate: 115200 })

  console.log('Port connected')
  keepReading = true
  while (port.readable && keepReading) {
    reader = port.readable.getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) {
          console.log('Serial communication stopped!')
          break
        }
        dataTemp = [...dataTemp, ...value]

        // A lots of unnecessary error checking, because I don't trust myself :/
        if (dataTemp.length > 6) {
          let isDataCorrupted = dataTemp[1] !== 0x5A
          const dsMode = dataTemp[0]
          if (dsMode !== 0x41 && dsMode !== 0x73 && dsMode !== 0x79) {
            isDataCorrupted = true
          }

          let paddingCount = 0
          if (isDataCorrupted) {
            for (let i = 0; i < dataTemp.length; i++) {
              if (dataTemp[i] === 0x45) {
                paddingCount++
              }
              if (paddingCount === 3) {
                console.log('Corrupted data, dumped: ' + dataTemp.splice(0, i + 1))
                // dataTemp.splice(0, i + 1)
                break
              }
            }
          } else {
            const temp = (dsMode & 0x0F) * 2 + 2
            if (dataTemp.length < temp + 3) {
              continue
            }
            if (dataTemp[temp] === 0x45 && dataTemp[temp + 1] === 0x45 && dataTemp[temp + 2] === 0x45) {
              // console.log('New data: ' + dataTemp.splice(0, temp + 3))
              setDs2SvgSerial(dataTemp.splice(0, temp + 3), dsMode, false)
              // dataTemp.splice(0, temp + 3)
              continue
            }

            // Something really wrong going on here
            for (let i = 0; i < dataTemp.length; i++) {
              if (dataTemp[i] === 0x45) {
                paddingCount++
              }
              if (paddingCount === 3) {
                console.log('Data is fucked up, dumped: ' + dataTemp.splice(0, i + 1))
                // dataTemp.splice(0, i + 1)
                break
              }
            }
          }
        }
      }
    } catch (error) {
      console.log('Serial error: ' + error)
    } finally {
      reader.releaseLock()
    }
  }

  await port.close()
}

// Stop Serial comunication
async function stopSerial() {
  keepReading = false
  reader.cancel()
  console.log('Serial communication stopped?')
}

// Shows to how many packages received per second from BLE device
function tick () {
  console.log('Data per second: ' + dataCount)
  dataCount = 0
}

// Receive notificaton and update svg
function updateSvgBle (event) {
  const data = event.target.value
  const length = data ? data.byteLength : 0
  if (length) {
    if (length < 4) {
      // Corrupted data
      return
    }

    // printDebugData(data, length)
    dataCount++
    setDs2SvgBle(data, length)
  } else {
    console.log('No data here (´・ω・`)')
  }
}

// [Unused] Print received data in hex
function printDebugData (data, length) {
  const message = []
  for (let i = 0; i < length; i++) {
    message.push((data.getUint8(i)).toString(16))
  }
  console.log('New message:' + message.join(' '))
}

// Change svg color based on BLE notification data, basically the same as setDs2SvgSerial()
function setDs2SvgBle (data, length) {
  // Note: Due to HM-10(bluetooth module I used) has a fixed 20 Byte MTU(how many bytes can bluetooth transmit per packet),
  // the first byte of data was truncated to fit the 21st byte (R2) in analog mode w/ pressure data.

  // Error checks
  if (length < 4) {
    // Corrupted data, ignored
    return
  }

  if (data.getUint8(1) !== 0x5A) {
    // Corrupted data, ignored
    return
  }
  const dsMode = data.getUint8(0)
  // if ((dsMode & 0xF0) === 0xF0) {
  //   // Controller is in config mode, ignore the data
  //   return
  // }

  const buffer = []
  for (let i = 0; i < length; i++) {
    buffer.push(data.getUint8(i))
  }

  setDs2SvgSerial(buffer, dsMode, length === 8)
}

// Change svg color based on serial data
function setDs2SvgSerial (data, dsMode, isIgnorePressure) {
  const dsDigital1 = data[2]
  const dsDigital2 = data[3]

  // Control buttons and L3/R3
  changeStyle(dsControls[0], 'fill', ((dsDigital1 & 0x01) > 0) ? 'none' : highlightColorString)
  changeStyle(dsSticks[0], 'fill', ((dsDigital1 & 0x02) > 0) ? 'none' : highlightColorString)
  changeStyle(dsSticks[1], 'fill', ((dsDigital1 & 0x04) > 0) ? 'none' : highlightColorString)
  changeStyle(dsControls[1], 'fill', ((dsDigital1 & 0x08) > 0) ? 'none' : highlightColorString)

  if (dsMode === 0x79 && !isIgnorePressure) {
    // Digital data
    // Arrows (U/R/D/L)
    changeStyle(dsArrows[0], 'stroke', ((dsDigital1 & 0x10) > 0) ? defaultColorString : highlightColorString)
    changeStyle(dsArrows[1], 'stroke', ((dsDigital1 & 0x20) > 0) ? defaultColorString : highlightColorString)
    changeStyle(dsArrows[2], 'stroke', ((dsDigital1 & 0x40) > 0) ? defaultColorString : highlightColorString)
    changeStyle(dsArrows[3], 'stroke', ((dsDigital1 & 0x80) > 0) ? defaultColorString : highlightColorString)
    // Buttons (Triangle/Circle/Cross/Square)
    changeStyle(dsButtons[0], 'stroke', ((dsDigital2 & 0x10) > 0) ? defaultColorString : highlightColorString)
    changeStyle(dsButtons[1], 'stroke', ((dsDigital2 & 0x20) > 0) ? defaultColorString : highlightColorString)
    changeStyle(dsButtons[2], 'stroke', ((dsDigital2 & 0x40) > 0) ? defaultColorString : highlightColorString)
    changeStyle(dsButtons[3], 'stroke', ((dsDigital2 & 0x80) > 0) ? defaultColorString : highlightColorString)

    // Pressure data
    // Arrows (R/L/U/D)
    // changeStyle(dsArrows[1], 'fill', `rgba(252, 175, 22, ${data[8] / 255})`)
    changeStyle(dsArrows[1], 'fill', blendColor(highlightColor, backgroundColor, data[8] / 255, true))
    changeStyle(dsArrows[3], 'fill', blendColor(highlightColor, backgroundColor, data[9] / 255, true))
    changeStyle(dsArrows[0], 'fill', blendColor(highlightColor, backgroundColor, data[10] / 255, true))
    changeStyle(dsArrows[2], 'fill', blendColor(highlightColor, backgroundColor, data[11] / 255, true))
    // Buttons (Triangle/Circle/Cross/Square)
    changeStyle(dsButtons[0], 'fill', blendColor(highlightColor, backgroundColor, data[12] / 255, true))
    changeStyle(dsButtons[1], 'fill', blendColor(highlightColor, backgroundColor, data[13] / 255, true))
    changeStyle(dsButtons[2], 'fill', blendColor(highlightColor, backgroundColor, data[14] / 255, true))
    changeStyle(dsButtons[3], 'fill', blendColor(highlightColor, backgroundColor, data[15] / 255, true))
    // Shoulder buttons (L1/R1/L2/R2)
    changeStyle(dsShoulders[0], 'fill', blendColor(highlightColor, backgroundColor, data[16] / 255, true))
    changeStyle(dsShoulders[1], 'fill', blendColor(highlightColor, backgroundColor, data[17] / 255, true))
    changeStyle(dsShoulders[0], 'stroke', blendColor(highlightColor, defaultColor, data[18] / 255, true))
    changeStyle(dsShoulders[1], 'stroke', blendColor(highlightColor, defaultColor, data[19] / 255, true))
  } else {
    // Reset stroke color
    // Arrows (U/R/D/L)
    changeStyle(dsArrows[0], 'stroke', defaultColorString)
    changeStyle(dsArrows[1], 'stroke', defaultColorString)
    changeStyle(dsArrows[2], 'stroke', defaultColorString)
    changeStyle(dsArrows[3], 'stroke', defaultColorString)
    // Buttons (Triangle/Circle/Cross/Square)
    changeStyle(dsButtons[0], 'stroke', defaultColorString)
    changeStyle(dsButtons[1], 'stroke', defaultColorString)
    changeStyle(dsButtons[2], 'stroke', defaultColorString)
    changeStyle(dsButtons[3], 'stroke', defaultColorString)

    // Arrows (U/R/D/L)
    changeStyle(dsArrows[0], 'fill', ((dsDigital1 & 0x10) > 0) ? 'none' : highlightColorString)
    changeStyle(dsArrows[1], 'fill', ((dsDigital1 & 0x20) > 0) ? 'none' : highlightColorString)
    changeStyle(dsArrows[2], 'fill', ((dsDigital1 & 0x40) > 0) ? 'none' : highlightColorString)
    changeStyle(dsArrows[3], 'fill', ((dsDigital1 & 0x80) > 0) ? 'none' : highlightColorString)
    // Shoulder buttons (L2/R2/L1/R1)
    changeStyle(dsShoulders[0], 'stroke', ((dsDigital2 & 0x01) > 0) ? defaultColorString : highlightColorString)
    changeStyle(dsShoulders[1], 'stroke', ((dsDigital2 & 0x02) > 0) ? defaultColorString : highlightColorString)
    changeStyle(dsShoulders[0], 'fill', ((dsDigital2 & 0x04) > 0) ? 'none' : highlightColorString)
    changeStyle(dsShoulders[1], 'fill', ((dsDigital2 & 0x08) > 0) ? 'none' : highlightColorString)
    // Buttons (Triangle/Circle/Cross/Square)
    changeStyle(dsButtons[0], 'fill', ((dsDigital2 & 0x10) > 0) ? 'none' : highlightColorString)
    changeStyle(dsButtons[1], 'fill', ((dsDigital2 & 0x20) > 0) ? 'none' : highlightColorString)
    changeStyle(dsButtons[2], 'fill', ((dsDigital2 & 0x40) > 0) ? 'none' : highlightColorString)
    changeStyle(dsButtons[3], 'fill', ((dsDigital2 & 0x80) > 0) ? 'none' : highlightColorString)
  }

  if (dsMode !== 0x41) {
    // Turn on analog led
    changeStyle(dsAnalogLed, 'fill', 'red')
    // Enable analog sticks
    changeStyle(dsSticks[0], 'stroke', highlightColorString)
    changeStyle(dsSticks[1], 'stroke', highlightColorString)

    // Set stick positon w/ dead zone
    let rightStickX = data[4] - 0x80
    let rightStickY = data[5] - 0x80
    let leftStickX = data[6] - 0x80
    let leftStickY = data[7] - 0x80

    const rightStickRadius = Math.sqrt((rightStickX ** 2) + (rightStickY ** 2))
    const leftStickRadius = Math.sqrt((leftStickX ** 2) + (leftStickY ** 2))

    if (rightStickRadius > deadzoneRadius) {
      rightStickX = rightStickX * deadzoneRadius / rightStickRadius
      rightStickY = rightStickY * deadzoneRadius / rightStickRadius
    }
    if (leftStickRadius > deadzoneRadius) {
      leftStickX = leftStickX * deadzoneRadius / leftStickRadius
      leftStickY = leftStickY * deadzoneRadius / leftStickRadius
    }

    dsSticks[0].setAttribute('cx', `${dsLeftStickCenter[0] + leftStickX * 0.065}`)
    dsSticks[0].setAttribute('cy', `${dsLeftStickCenter[1] + leftStickY * 0.065}`)
    dsSticks[1].setAttribute('cx', `${dsRightStickCenter[0] + rightStickX * 0.065}`)
    dsSticks[1].setAttribute('cy', `${dsRightStickCenter[1] + rightStickY * 0.065}`)
  } else {
    // Switch off analog led
    changeStyle(dsAnalogLed, 'fill', 'none')
    // Disable analog sticks
    changeStyle(dsSticks[0], 'stroke', disabledColor)
    changeStyle(dsSticks[1], 'stroke', disabledColor)

    // Reset stick position
    dsSticks[1].setAttribute('cx', `${dsLeftStickCenter[0]}`)
    dsSticks[1].setAttribute('cy', `${dsLeftStickCenter[1]}`)
    dsSticks[0].setAttribute('cx', `${dsRightStickCenter[0]}`)
    dsSticks[0].setAttribute('cy', `${dsRightStickCenter[1]}`)
  }
}
