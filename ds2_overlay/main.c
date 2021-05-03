/* USER CODE BEGIN Header */
/**
 ******************************************************************************
 * @file           : main.c
 * @brief          : Main program body
 ******************************************************************************
 * @attention
 *
 * <h2><center>&copy; Copyright (c) 2021 STMicroelectronics.
 * All rights reserved.</center></h2>
 *
 * This software component is licensed by ST under Ultimate Liberty license
 * SLA0044, the "License"; You may not use this file except in compliance with
 * the License. You may obtain a copy of the License at:
 *                             www.st.com/SLA0044
 *
 ******************************************************************************
 */
/* USER CODE END Header */
/* Includes ------------------------------------------------------------------*/
#include "main.h"
#include "usb_device.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include "usbd_cdc_if.h"
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */

/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */
/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */

/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
SPI_HandleTypeDef hspi1;

UART_HandleTypeDef huart3;

/* USER CODE BEGIN PV */
volatile uint8_t rx_flag = 0;
const uint8_t usb_padding_byte = 0x45;
const uint8_t usb_padding_count = 0x45;
uint8_t command_byte_count = 0;
uint8_t ds_mode = 0;
uint8_t miso_data[24] = { 0 };
/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_SPI1_Init(void);
static void MX_USART3_UART_Init(void);
/* USER CODE BEGIN PFP */

/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */

/* USER CODE END 0 */

/**
  * @brief  The application entry point.
  * @retval int
  */
int main(void)
{
  /* USER CODE BEGIN 1 */

  /* USER CODE END 1 */

  /* MCU Configuration--------------------------------------------------------*/

  /* Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();

  /* USER CODE BEGIN Init */

  /* USER CODE END Init */

  /* Configure the system clock */
  SystemClock_Config();

  /* USER CODE BEGIN SysInit */

  /* USER CODE END SysInit */

  /* Initialize all configured peripherals */
  MX_GPIO_Init();
  MX_SPI1_Init();
  MX_USART3_UART_Init();
  MX_USB_DEVICE_Init();
  /* USER CODE BEGIN 2 */

  /* USER CODE END 2 */

  /* Infinite loop */
  /* USER CODE BEGIN WHILE */
	while (1) {
    /* USER CODE END WHILE */

    /* USER CODE BEGIN 3 */
		switch (rx_flag) {
		case 0:
			// Get first 3 bytes from MISO of controller
//			HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//			HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//			HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
			HAL_SPI_Receive_IT(&hspi1, miso_data, 3);
			rx_flag = 1;
			break;
		case 2:
			// First 3 bytes received
			if (miso_data[2] != 0x5A || miso_data[0] != 0xFF) {
				// Controller's changing mode (miso_data[2] == 0x00) or a corrupted data
				rx_flag = 9;
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
				break;
			}

			// Get current mode of controller
			// High nibble indicates the mode of the controller (4 for digital, 7 for analog, F for config mode)
			// Low nibble indicates the length of incoming **16 bit** data
			ds_mode = miso_data[1];
			command_byte_count = (ds_mode & 0x0F) * 2;
			if (ds_mode != 0x41 && ds_mode != 0x73 && ds_mode != 0x79) {
				// Controller's in config mode (miso_data[1] == 0xF3) or a corrupted data, abort
				rx_flag = 9;
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
				break;
			}

			// Get the rest of bytes
			HAL_SPI_Receive_IT(&hspi1, &miso_data[3], command_byte_count);
//			HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_14);
			rx_flag++;
			break;
		case 4:
			// Output data through bluetooth or USB serial
			// I excluded the first byte as a workaround for my HM-10's 20 byte MTU size, which can not be changed
//			HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
//			HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
			if (command_byte_count > 6) {
				if (HAL_GPIO_ReadPin(GPIOB, GPIO_PIN_9) == GPIO_PIN_RESET) {
					// Send full length data if both side of your bluetooth device can handle this
					HAL_UART_Transmit_IT(&huart3, &miso_data[1], command_byte_count + 2);
				} else {
					// Truncate pressure data to improve stability
					// But it still laggy sometime in my case, especially using other BLE device at the same time
					HAL_UART_Transmit_IT(&huart3, &miso_data[1], 8);
				}
			} else {
				// Send full length data
				HAL_UART_Transmit_IT(&huart3, &miso_data[1], command_byte_count + 2);
			}

			// Add padding 0x45 to the end of stream, since there is no way to know the end of data in serial communication in this case?
			memset(&miso_data[command_byte_count + 3], usb_padding_byte, usb_padding_count);
			CDC_Transmit_FS(&miso_data[1], command_byte_count + 5);
			rx_flag++;
			break;
		default:
			break;
		}
	}
  /* USER CODE END 3 */
}

/**
  * @brief System Clock Configuration
  * @retval None
  */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};
  RCC_PeriphCLKInitTypeDef PeriphClkInit = {0};

  /** Initializes the RCC Oscillators according to the specified parameters
  * in the RCC_OscInitTypeDef structure.
  */
  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_HSE;
  RCC_OscInitStruct.HSEState = RCC_HSE_ON;
  RCC_OscInitStruct.HSEPredivValue = RCC_HSE_PREDIV_DIV1;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL.PLLSource = RCC_PLLSOURCE_HSE;
  RCC_OscInitStruct.PLL.PLLMUL = RCC_PLL_MUL9;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }
  /** Initializes the CPU, AHB and APB buses clocks
  */
  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_SYSCLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2;
  RCC_ClkInitStruct.SYSCLKSource = RCC_SYSCLKSOURCE_PLLCLK;
  RCC_ClkInitStruct.AHBCLKDivider = RCC_SYSCLK_DIV1;
  RCC_ClkInitStruct.APB1CLKDivider = RCC_HCLK_DIV2;
  RCC_ClkInitStruct.APB2CLKDivider = RCC_HCLK_DIV1;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct, FLASH_LATENCY_2) != HAL_OK)
  {
    Error_Handler();
  }
  PeriphClkInit.PeriphClockSelection = RCC_PERIPHCLK_USB;
  PeriphClkInit.UsbClockSelection = RCC_USBCLKSOURCE_PLL_DIV1_5;
  if (HAL_RCCEx_PeriphCLKConfig(&PeriphClkInit) != HAL_OK)
  {
    Error_Handler();
  }
}

/**
  * @brief SPI1 Initialization Function
  * @param None
  * @retval None
  */
static void MX_SPI1_Init(void)
{

  /* USER CODE BEGIN SPI1_Init 0 */

  /* USER CODE END SPI1_Init 0 */

  /* USER CODE BEGIN SPI1_Init 1 */

  /* USER CODE END SPI1_Init 1 */
  /* SPI1 parameter configuration*/
  hspi1.Instance = SPI1;
  hspi1.Init.Mode = SPI_MODE_SLAVE;
  hspi1.Init.Direction = SPI_DIRECTION_2LINES_RXONLY;
  hspi1.Init.DataSize = SPI_DATASIZE_8BIT;
  hspi1.Init.CLKPolarity = SPI_POLARITY_HIGH;
  hspi1.Init.CLKPhase = SPI_PHASE_2EDGE;
  hspi1.Init.NSS = SPI_NSS_HARD_INPUT;
  hspi1.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_128;
  hspi1.Init.FirstBit = SPI_FIRSTBIT_LSB;
  hspi1.Init.TIMode = SPI_TIMODE_DISABLE;
  hspi1.Init.CRCCalculation = SPI_CRCCALCULATION_DISABLE;
  hspi1.Init.CRCPolynomial = 10;
  if (HAL_SPI_Init(&hspi1) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN SPI1_Init 2 */

  /* USER CODE END SPI1_Init 2 */

}

/**
  * @brief USART3 Initialization Function
  * @param None
  * @retval None
  */
static void MX_USART3_UART_Init(void)
{

  /* USER CODE BEGIN USART3_Init 0 */

  /* USER CODE END USART3_Init 0 */

  /* USER CODE BEGIN USART3_Init 1 */

  /* USER CODE END USART3_Init 1 */
  huart3.Instance = USART3;
  huart3.Init.BaudRate = 230400;
  huart3.Init.WordLength = UART_WORDLENGTH_8B;
  huart3.Init.StopBits = UART_STOPBITS_1;
  huart3.Init.Parity = UART_PARITY_NONE;
  huart3.Init.Mode = UART_MODE_TX;
  huart3.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart3.Init.OverSampling = UART_OVERSAMPLING_16;
  if (HAL_UART_Init(&huart3) != HAL_OK)
  {
    Error_Handler();
  }
  /* USER CODE BEGIN USART3_Init 2 */

  /* USER CODE END USART3_Init 2 */

}

/**
  * @brief GPIO Initialization Function
  * @param None
  * @retval None
  */
static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};

  /* GPIO Ports Clock Enable */
  __HAL_RCC_GPIOC_CLK_ENABLE();
  __HAL_RCC_GPIOD_CLK_ENABLE();
  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_GPIOB_CLK_ENABLE();

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(LED_GPIO_Port, LED_Pin, GPIO_PIN_SET);

  /*Configure GPIO pin Output Level */
  HAL_GPIO_WritePin(GPIOC, Debug_1_Pin|Debug_2_Pin, GPIO_PIN_RESET);

  /*Configure GPIO pins : LED_Pin Debug_1_Pin Debug_2_Pin */
  GPIO_InitStruct.Pin = LED_Pin|Debug_1_Pin|Debug_2_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_HIGH;
  HAL_GPIO_Init(GPIOC, &GPIO_InitStruct);

  /*Configure GPIO pin : EXTI3_CS_Pin */
  GPIO_InitStruct.Pin = EXTI3_CS_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_IT_RISING_FALLING;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(EXTI3_CS_GPIO_Port, &GPIO_InitStruct);

  /*Configure GPIO pin : GPIO_BLE_FULL_LENGTH_Pin */
  GPIO_InitStruct.Pin = GPIO_BLE_FULL_LENGTH_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_INPUT;
  GPIO_InitStruct.Pull = GPIO_PULLUP;
  HAL_GPIO_Init(GPIO_BLE_FULL_LENGTH_GPIO_Port, &GPIO_InitStruct);

  /* EXTI interrupt init*/
  HAL_NVIC_SetPriority(EXTI3_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(EXTI3_IRQn);

}

/* USER CODE BEGIN 4 */
void HAL_SPI_RxCpltCallback(SPI_HandleTypeDef *hspi) {
//	HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_15);
	rx_flag++;
}

void HAL_UART_TxCpltCallback(UART_HandleTypeDef *huart) {
	HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_13);
}

void HAL_GPIO_EXTI_Callback(uint16_t GPIO_Pin) {
	if (GPIO_Pin == GPIO_PIN_3) {
//		HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_14);
		if (HAL_GPIO_ReadPin(GPIOA, GPIO_PIN_3) == GPIO_PIN_RESET) {
//			for (int i = 0; i < HAL_SPI_GetState(&hspi1); i++) {
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_14);
//			}
			if (HAL_SPI_GetState(&hspi1) != HAL_SPI_STATE_BUSY_RX) {
				// Should be always true in normal operation
				rx_flag = 0;
			}
		} else {
			if (HAL_SPI_GetState(&hspi1) == HAL_SPI_STATE_READY) {
				// Should be always true in normal operation
				HAL_SPI_Abort(&hspi1);
//				HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_14);
			}
//			HAL_GPIO_TogglePin(GPIOC, GPIO_PIN_14);
		}
	}
}

//void HAL_SPI_ErrorCallback(SPI_HandleTypeDef *hspi) {
//	HAL_GPIO_WritePin(GPIOC, GPIO_PIN_13, GPIO_PIN_RESET);
//}
/* USER CODE END 4 */

/**
  * @brief  This function is executed in case of error occurrence.
  * @retval None
  */
void Error_Handler(void)
{
  /* USER CODE BEGIN Error_Handler_Debug */
	/* User can add his own implementation to report the HAL error return state */
	__disable_irq();
	while (1) {
	}
  /* USER CODE END Error_Handler_Debug */
}

#ifdef  USE_FULL_ASSERT
/**
  * @brief  Reports the name of the source file and the source line number
  *         where the assert_param error has occurred.
  * @param  file: pointer to the source file name
  * @param  line: assert_param error line source number
  * @retval None
  */
void assert_failed(uint8_t *file, uint32_t line)
{
  /* USER CODE BEGIN 6 */
  /* User can add his own implementation to report the file name and line number,
     ex: printf("Wrong parameters value: file %s on line %d\r\n", file, line) */
  /* USER CODE END 6 */
}
#endif /* USE_FULL_ASSERT */

/************************ (C) COPYRIGHT STMicroelectronics *****END OF FILE****/
