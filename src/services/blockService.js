const BASE_API = 'https://mainnet.neardata.xyz/v0'

export async function fetchLatestFinalBlock() {
  try {
    const response = await fetch(`${BASE_API}/last_block/final`)
    const data = await response.json()
    console.log('Raw block data:', data)
    if (!data || !data.block) {
      console.error('Invalid block data structure:', data)
      return null
    }
    return { 
      block: data, 
      shardData: processBlockData(data)
    }
  } catch (error) {
    console.error('Error fetching latest block:', error)
    return null
  }
}

export async function fetchBlockByHeight(height) {
  try {
    const response = await fetch(`${BASE_API}/block/${height}`)
    const data = await response.json()
    if (!data) return null
    if (!data.block) {
      console.error('Invalid block data structure:', data)
      return null
    }
    return { 
      block: data, 
      shardData: processBlockData(data)
    }
  } catch (error) {
    console.error('Error fetching block by height:', error)
    return null
  }
}

async function waitForNextBlock(height) {
  try {
    while (true) {
      const data = await fetchBlockByHeight(height)
      if (data) return data
      await new Promise(resolve => setTimeout(resolve, 200)) // Wait 200ms before trying again
    }
  } catch (error) {
    console.error('Error waiting for next block:', error)
    return null
  }
}

export { waitForNextBlock }

function processBlockData(block) {
  const shardData = new Array(6).fill(null).map(() => ({
    accounts: new Map(), // account_id -> {receipts: number, transactions: number}
    transactions: [],
    receipts: []
  }))

  // Process transactions
  block.shards.forEach(shard => {
    const shardId = shard.shard_id

    // Process transactions in this shard
    shard.chunk?.transactions?.forEach(tx => {
      // Add signer to accounts map
      const signerCount = shardData[shardId].accounts.get(tx.transaction.signer_id) || { receipts: 0, transactions: 0 }
      signerCount.transactions++
      shardData[shardId].accounts.set(tx.transaction.signer_id, signerCount)
      
      // Add receiver to accounts map
      const receiverCount = shardData[shardId].accounts.get(tx.transaction.receiver_id) || { receipts: 0, transactions: 0 }
      receiverCount.transactions++
      shardData[shardId].accounts.set(tx.transaction.receiver_id, receiverCount)

      shardData[shardId].transactions.push({
        hash: tx.transaction.hash,
        signerId: tx.transaction.signer_id,
        receiverId: tx.transaction.receiver_id,
        gas: tx.outcome.execution_outcome.outcome.gas_burnt,
        tokens: tx.outcome.execution_outcome.outcome.tokens_burnt
      })
    })

    // Process receipts in this shard
    shard.chunk?.receipts?.forEach(receipt => {
      if (receipt.receipt.Action) {
        const receiverId = receipt.receiver_id
        const predecessorId = receipt.predecessor_id
        
        // Add predecessor to accounts map
        const predecessorCount = shardData[shardId].accounts.get(predecessorId) || { receipts: 0, transactions: 0 }
        predecessorCount.transactions++
        shardData[shardId].accounts.set(predecessorId, predecessorCount)
        
        // Add receiver to accounts map
        const currentCount = shardData[shardId].accounts.get(receiverId) || { receipts: 0, transactions: 0 }
        currentCount.receipts++
        shardData[shardId].accounts.set(receiverId, currentCount)

        shardData[shardId].receipts.push({
          id: receipt.receipt_id,
          predecessorId: receipt.predecessor_id,
          receiverId: receipt.receiver_id,
          gas: receipt.receipt.Action.gas || 0
        })
      }
    })
  })

  // Debug log
  console.log('Processed block data:', {
    accounts: shardData.map(s => Array.from(s.accounts.entries())),
    transactions: shardData.map(s => s.transactions.length),
    receipts: shardData.map(s => s.receipts.length)
  })

  return shardData
} 