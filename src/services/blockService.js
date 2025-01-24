const BLOCK_API = 'https://mainnet.neardata.xyz/v0/last_block/final'

export async function fetchLatestBlock() {
  try {
    const response = await fetch(BLOCK_API)
    const data = await response.json()
    return processBlockData(data)
  } catch (error) {
    console.error('Error fetching block data:', error)
    return null
  }
}

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
        const currentShard = shardData[shardId]
        
        // Update account receipt count
        const currentCount = currentShard.accounts.get(receiverId) || { receipts: 0, transactions: 0 }
        currentCount.receipts++
        currentShard.accounts.set(receiverId, currentCount)

        shardData[shardId].receipts.push({
          id: receipt.receipt_id,
          predecessorId: receipt.predecessor_id,
          receiverId: receipt.receiver_id,
          gas: receipt.receipt.Action.gas_price || 0
        })
      }
    })
  })

  return shardData
} 