import { computed, nextTick, onMounted, ref, toRefs, watch } from '@vue/composition-api'

import CommonUtils from '@/util/common-util'
import { GetFeeRequestParams } from '@/models/Payment'
import { ManualTransactionDetails } from '@/models/RoutingSlip'
import { createNamespacedHelpers } from 'vuex-composition-helpers'
import debounce from '@/util/debounce'

const routingSlipModule = createNamespacedHelpers('routingSlip') // specific module name
const { useActions } = routingSlipModule

// Composable function to inject Props, options and values to AddManualTransactionDetails component
export default function useAddManualTransactionDetails (props, context) {
  const { manualTransaction, index } = toRefs(props)

  // Object that holds the input fields - seed it using property
  const manualTransactionDetails = ref<ManualTransactionDetails>(undefined)

  // Input field rules
  const requiredFieldRule = CommonUtils.requiredFieldRule()

  // vuex action and state
  const { getFeeByCorpTypeAndFilingType } = useActions([
    'getFeeByCorpTypeAndFilingType'
  ])

  const errorMessage = computed(() => {
    /* We need to check if total exceeds remaining amount and
    if the availableAmountForManualTransaction is greater than 0 as any change in prior transaction records affect the remaining amount of this record
    */
    const msg = manualTransactionDetails.value.quantity && (
      manualTransactionDetails.value.availableAmountForManualTransaction < manualTransactionDetails.value.total ||
      manualTransactionDetails.value.availableAmountForManualTransaction < 0)
      ? 'Amount exceeds the routing slip\'s current balance' : ''
    return msg
  })

  // Calculate total fee from pay-api service, triggered if its dependent values are changed
  async function calculateTotal () {
    try {
      if (manualTransactionDetails && manualTransactionDetails.value.filingType && manualTransactionDetails.value.quantity) {
        const getFeeRequestParams: GetFeeRequestParams = {
          corpTypeCode: manualTransactionDetails.value.filingType.corpTypeCode.code,
          filingTypeCode: manualTransactionDetails.value.filingType.filingTypeCode.code,
          requestParams: {
            quantity: manualTransactionDetails.value.quantity,
            priority: manualTransactionDetails.value.priority,
            futureEffective: manualTransactionDetails.value.futureEffective
          }
        }
        manualTransactionDetails.value.total = await getFeeByCorpTypeAndFilingType(getFeeRequestParams)
      } else {
        manualTransactionDetails.value.total = null
      }
    } catch (error: any) {
      manualTransactionDetails.value.total = null
      // TODO : Business errors (400s) need to be handled
      // eslint-disable-next-line no-console
      console.error('error ', error?.response?.data)
    } finally {
      emitManualTransactionDetails()
    }
  }

  const delayedCalculateTotal = debounce(() => {
    calculateTotal()
  })

  // Emit this remove row event, that is consumed in parent and slice the v-model array of parent
  function removeManualTransactionRowEventHandler () {
    context.emit('removeManualTransactionRow', index.value)
  }

  // Emits the updated manual transactio ndetail event to the parent
  function emitManualTransactionDetails () {
    context.emit('updateManualTransaction', { transaction: manualTransactionDetails.value, index: index.value })
  }

  function getIndexedTag (tag, index): string {
    return `${tag}-${index}`
  }

  // watch manualTransaction object, assign availableAmountForManualTransaction property.
  watch(manualTransaction, () => {
    manualTransactionDetails.value.availableAmountForManualTransaction = manualTransaction.value.availableAmountForManualTransaction
  }, { deep: true })

  onMounted(() => {
    manualTransactionDetails.value = JSON.parse(JSON.stringify(manualTransaction.value))
  })

  return {
    manualTransactionDetails,
    requiredFieldRule,
    removeManualTransactionRowEventHandler,
    delayedCalculateTotal,
    calculateTotal,
    getIndexedTag,
    emitManualTransactionDetails,
    errorMessage
  }
}
