import { useState } from 'react'
import CompA from '../components/compA.tsx'
import CompB from '../components/compB.tsx'

import './index.css'
import './indexb.css'

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
        <div className="bindColor">click to random color</div>
        <div className="bindBgColor">click to random background-color</div>
        asdsa
      </div>
      <div>
        <div className="xxx">xxx</div>
        <div className="xxx">xxx</div>
        asdsadas
      </div>
      adsad
      <div>asdasds</div>
      <div style={{ padding: 15 }}>
        <CompA></CompA>
      </div>
      <CompB></CompB>
    </>
  )
}
