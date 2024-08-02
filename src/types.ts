export interface Options {}

declare global {
  function yourTransformedFunction(...args: any[]): any
  // 如果有多个函数，可以继续添加
  // function anotherFunction(...args: any[]): any;
}
