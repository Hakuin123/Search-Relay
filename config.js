/**
 * 默认的搜索引擎列表（统一结构）
 */
export const DEFAULT_ENGINES = [
  {
    id: 'google',
    name: 'Google',
    url: 'https://www.google.com/search?q=%s',
    badge: 'G',
    domain: 'google.com',
    param: 'q',
    isTarget: true,
    isSource: true
  },
  {
    id: 'baidu',
    name: '百度',
    url: 'https://www.baidu.com/s?wd=%s',
    badge: '百度',
    domain: 'baidu.com',
    param: 'wd',
    isTarget: true,
    isSource: true
  },
  {
    id: 'bing',
    name: 'Bing',
    url: 'https://www.bing.com/search?q=%s',
    badge: 'Bing',
    domain: 'bing.com',
    param: 'q',
    isTarget: true,
    isSource: true
  },
  {
    id: 'bing_cn',
    name: 'Bing 中国',
    url: 'https://cn.bing.com/search?q=%s',
    badge: 'Bing',
    domain: 'cn.bing.com',
    param: 'q',
    isTarget: false,
    isSource: true
  },
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    url: 'https://duckduckgo.com/?q=%s',
    badge: 'D',
    domain: 'duckduckgo.com',
    param: 'q',
    isTarget: true,
    isSource: true
  },
  {
    id: 'sogou',
    name: '搜狗',
    url: 'https://www.sogou.com/web?query=%s',
    badge: '搜狗',
    domain: 'sogou.com',
    param: 'query',
    isTarget: false,
    isSource: true
  },
  {
    id: 'so',
    name: '360搜索',
    url: 'https://www.so.com/s?q=%s',
    badge: '360',
    domain: 'so.com',
    param: 'q',
    isTarget: false,
    isSource: true
  },
  {
    id: 'yandex',
    name: 'Yandex',
    url: 'https://yandex.com/search/?text=%s',
    badge: 'Y',
    domain: 'yandex.com',
    param: 'text',
    isTarget: false,
    isSource: true
  },
  {
    id: 'yahoo',
    name: 'Yahoo',
    url: 'https://search.yahoo.com/search?p=%s',
    badge: 'Y!',
    domain: 'search.yahoo.com',
    param: 'p',
    isTarget: false,
    isSource: true
  }
];
