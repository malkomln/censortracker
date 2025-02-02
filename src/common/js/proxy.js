import { registry, storage } from '.'
import { getBrowser, isFirefox } from './browser'

class Proxy {
  constructor () {
    this.browser = getBrowser()
    this.proxyPort = 33333
    this.proxyHost = 'proxy-ssl.roskomsvoboda.org'
    this.proxyUrl = `${this.proxyHost}:${this.proxyPort}`
    this.isFirefox = isFirefox()
    this.resetProxyTimeout = 60 * 60 * 5000

    setInterval(async () => {
      await this.setProxy()
    }, this.resetProxyTimeout)
  }

  getProxyServerURL = async () => {
    const { customProxyHost, customProxyPort } =
        await storage.get(['customProxyHost', 'customProxyPort'])

    if (customProxyHost && customProxyPort) {
      return `${customProxyHost}:${customProxyPort}`
    }

    return this.proxyUrl
  }

  setProxy = async () => {
    const config = {}
    const pacData = await this.generateProxyAutoConfigData()

    if (this.isFirefox) {
      const blob = new Blob([pacData], { type: 'application/x-ns-proxy-autoconfig' })

      config.value = {
        proxyType: 'autoConfig',
        autoConfigUrl: URL.createObjectURL(blob),
      }
    } else {
      config.scope = 'regular'
      config.value = {
        mode: 'pac_script',
        pacScript: {
          data: pacData,
          mandatory: false,
        },
      }
    }

    await this.allowProxying()
    await this.browser.proxy.settings.set(config)
    await storage.set({ useProxy: true })
    console.warn('PAC has been set successfully!')
  }

  /**
   * ATTENTION: DO NOT MODIFY THIS FUNCTION!
   * @returns {string} The PAC data.
   */
  generateProxyAutoConfigData = async () => {
    const domains = await registry.getDomains()

    domains.sort()
    return `
      function FindProxyForURL(url, host) {
        function isHostBlocked(array, target) {
          let left = 0;
          let right = array.length - 1;

          while (left <= right) {
            const mid = left + Math.floor((right - left) / 2);

            if (array[mid] === target) {
              return true;
            }

            if (array[mid] < target) {
              left = mid + 1;
            } else {
              right = mid - 1;
            }
          }
          return false;
        }

        // Remove ending dot
        if (host.endsWith('.')) {
          host = host.substring(0, host.length - 1);
        }

        // Make domain second-level.
        let lastDot = host.lastIndexOf('.');
        if (lastDot !== -1) {
          lastDot = host.lastIndexOf('.', lastDot - 1);
          if (lastDot !== -1) {
            host = host.substr(lastDot + 1);
          }
        }

        // Domains, which are blocked.
        let domains = ${JSON.stringify(domains)};

        // Return result
        if (isHostBlocked(domains, host)) {
          return 'HTTPS ${await this.getProxyServerURL()};';
        } else {
          return 'DIRECT';
        }
      }`
  }

  removeProxy = async () => {
    await storage.set({ useProxy: false })
    await this.browser.proxy.settings.clear({})
    console.warn('Proxy auto-config data cleaned!')
  }

  allowProxying = () => {
    const request = new XMLHttpRequest()
    const proxyServerUrl = 'https://163.172.211.183:39263'

    request.open('GET', proxyServerUrl, true)
    request.addEventListener('error', (_error) => {
      console.log('Error on opening port')
    })
    request.send(null)
  }

  proxyingEnabled = async () => {
    const { useProxy } =
      await storage.get({ useProxy: true })

    return useProxy
  }

  enableProxy = async () => {
    console.warn('Proxying enabled.')
    await storage.set({
      useProxy: true,
    })
  }

  disableProxy = async () => {
    console.warn('Proxying disabled.')
    await storage.set({
      useProxy: false,
    })
  }

  controlledByOtherExtensions = async () => {
    const { levelOfControl } =
      await this.browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_other_extensions'
  }

  controlledByThisExtension = async () => {
    const { levelOfControl } =
      await this.browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_this_extension'
  }

  debugging = async () => {
    await storage.set({ domains: [] })
    await this.setProxy()
    console.warn('Debug mode enabled')
  }
}

export default new Proxy()
