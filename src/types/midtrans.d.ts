declare module 'midtrans-client' {
  export class Snap {
    constructor(options: {
      isProduction: boolean
      serverKey: string
      clientKey: string
    })
    createTransaction(parameter: Record<string, unknown>): Promise<{ token: string; redirect_url: string }>
  }

  export class CoreApi {
    constructor(options: {
      isProduction: boolean
      serverKey: string
      clientKey: string
    })
    transaction: {
      notification(notification: Record<string, unknown>): Promise<Record<string, string>>
    }
  }
}