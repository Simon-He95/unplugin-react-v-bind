import { useState } from 'react'
import './index.css'

export default function () {
  const [_color, setColor] = useState<string>('yellow')

  function clickHandler() {
    // 生成一个 随机颜色
    const randomColor = `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padEnd(6, '0')}`
    setColor(randomColor)
  }

  return (
    <>
      <h3>CompA</h3>
      <div className="aa" onClick={() => clickHandler()}>
        <div className="bindColor">click to random color</div>
        <div className="bindBgColor">click to random background-color</div>
      </div>
    </>
  )
}
