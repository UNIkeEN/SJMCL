//! 令牌桶限速器（同步实现，供 poll 型读取器使用）。
//!
//! 与 `tokio::time` 无关，`consume(n)` 返回需要等待的时长，
//! 由调用方（DownloadReader）挂 Sleep 驱动——适配 AsyncRead 的 poll 语义。

use std::sync::Mutex;
use std::time::{Duration, Instant};

struct TokenState {
  /// 当前积攒的字节数（≤ capacity）。
  tokens: f64,
  last: Instant,
}

pub struct TokenBucket {
  /// 补充速率（bytes/sec）。
  rate: f64,
  /// 突发容量（bytes）。
  capacity: f64,
  state: Mutex<TokenState>,
}

impl TokenBucket {
  pub fn new(rate_bps: u64, burst_bytes: u64) -> Self {
    TokenBucket {
      rate: rate_bps.max(1) as f64,
      capacity: burst_bytes as f64,
      state: Mutex::new(TokenState {
        tokens: burst_bytes as f64,
        last: Instant::now(),
      }),
    }
  }

  /// 消费 n 字节，返回必须等待的时长。
  /// 令牌允许为负（睡眠期间的重填先偿还债务），
  /// 因此每个等待周期恰好覆盖一次读取，输出速率精确等于 rate。
  pub fn consume(&self, n: u64) -> Duration {
    let mut st = self.state.lock().unwrap();
    let now = Instant::now();
    let elapsed = now.duration_since(st.last).as_secs_f64();
    st.tokens = (st.tokens + elapsed * self.rate).min(self.capacity);
    st.last = now;
    let need = n as f64;
    let wait = if st.tokens >= need {
      0.0
    } else {
      (need - st.tokens) / self.rate
    };
    st.tokens -= need; // 允许为负：下次重填先还债
    Duration::from_secs_f64(wait)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn bursts_then_throttles() {
    let bucket = TokenBucket::new(1000, 2000);
    assert_eq!(bucket.consume(1000), Duration::ZERO); // 突发容量内
    assert_eq!(bucket.consume(1000), Duration::ZERO);
    let wait = bucket.consume(1000); // 超过容量 → 需要 1s
    assert!(wait >= Duration::from_millis(999));
  }

  #[test]
  fn refills_over_time() {
    let bucket = TokenBucket::new(1000, 1000);
    assert_eq!(bucket.consume(1000), Duration::ZERO); // 清空突发容量
    assert!(bucket.consume(100) > Duration::from_millis(90)); // 空了 → 需等 100ms
    std::thread::sleep(Duration::from_millis(200));
    assert_eq!(bucket.consume(100), Duration::ZERO); // 200ms 已攒 200 令牌
  }
}
