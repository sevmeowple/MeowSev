// browser.ts
import puppeteer from "puppeteer";
import type { Browser } from "puppeteer";

class BrowserManager {
  private static instance: BrowserManager;
  private browserPromise: Promise<Browser> | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly RECONNECT_DELAY = 1000;

  private constructor() {}

  static getInstance(): BrowserManager {
    if (!BrowserManager.instance) {
      BrowserManager.instance = new BrowserManager();
    }
    return BrowserManager.instance;
  }

  private async setupBrowserListeners(browser: Browser) {
    browser.on('disconnected', async () => {
      console.log('[Browser] 连接断开');
      this.isConnected = false;
      this.browserPromise = null;
      await this.reconnect();
    });

    this.isConnected = true;
    this.reconnectAttempts = 0;
  }

  private async reconnect() {
    if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      console.error('[Browser] 重连次数超过限制');
      return;
    }

    console.log(`[Browser] 尝试重连 (${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
    this.reconnectAttempts++;

    try {
      await this.getBrowser();
    } catch (error) {
      console.error('[Browser] 重连失败:', error);
      setTimeout(() => this.reconnect(), this.RECONNECT_DELAY);
    }
  }

  async getBrowser(): Promise<Browser> {
    if (!this.browserPromise || !this.isConnected) {
      this.browserPromise = puppeteer.launch({
        headless: "shell",
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      }).then(async browser => {
        await this.setupBrowserListeners(browser);
        return browser;
      });
    }

    try {
      const browser = await this.browserPromise;
      if (!browser.isConnected()) {
        throw new Error('浏览器未连接');
      }
      return browser;
    } catch (error) {
      console.error('[Browser] 获取浏览器实例失败:', error);
      this.browserPromise = null;
      this.isConnected = false;
      throw error;
    }
  }

  async close() {
    if (this.browserPromise) {
      try {
        const browser = await this.browserPromise;
        await browser.close();
      } catch (error) {
        console.error('[Browser] 关闭失败:', error);
      } finally {
        this.browserPromise = null;
        this.isConnected = false;
      }
    }
  }
}

export const browserManager = BrowserManager.getInstance();