import { useEffect, useState } from 'react'
import './index.css'

export default function () {
  const [_color, setColor] = useState<string>('red')

  function clickHandler() {
    // 生成一个 随机颜色
    const randomColor = `#${Math.floor(Math.random() * 0xFFFFFF).toString(16).padEnd(6, '0')}`
    setColor(randomColor)
  }

  return (
    <>
      <div className="aa" onClick={() => clickHandler()}>
        <div className="bindColor">nihao</div>
        <div className="bindColor">yys</div>
        asdsa
      </div>
      <div>
        <div className="xxx">xxx</div>
        <div className="xxx">xxx</div>
        asdsadas
      </div>
      adsad
      <div>asdasds</div>
    </>
  )
}
