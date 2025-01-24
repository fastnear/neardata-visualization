import { useState, useEffect } from 'react'
import './App.css'
import BlockVisualizer from './components/BlockVisualizer'
import { fetchLatestBlock } from './services/blockService'

function App() {
  const [blockData, setBlockData] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      const data = await fetchLatestBlock()
      setBlockData(data)
    }

    fetchData()
  }, [])

  return (
    <div className="App">
      <h1>NEAR Protocol Block Visualizer</h1>
      <button onClick={() => fetchLatestBlock().then(setBlockData)}>
        Fetch Next Block
      </button>
      <div className="visualizer-container">
        <BlockVisualizer data={blockData} />
      </div>
    </div>
  )
}

export default App
