//! Synchronous token bucket for poll-based readers.
//!
//! consume(n) returns the required delay without awaiting Tokio time.
//! DownloadReader polls a Sleep for that delay to preserve AsyncRead semantics.

use std::sync::Mutex;
use std::time::{Duration, Instant};

struct TokenState {
  /// Accumulated tokens, capped at capacity.
  tokens: f64,
  last: Instant,
}

pub struct TokenBucket {
  /// Refill rate in bytes per second.
  rate: f64,
  /// Burst capacity in bytes.
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

  /// Consume n bytes and return the delay needed before the next read.
  /// Tokens may become negative; refills during the delay pay back this debt.
  /// This accounts for each read once and enforces the configured average rate.
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
    st.tokens -= need; // Allow debt; the next refill pays it back.
    Duration::from_secs_f64(wait)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn bursts_then_throttles() {
    let bucket = TokenBucket::new(1000, 2000);
    assert_eq!(bucket.consume(1000), Duration::ZERO); // Within burst capacity.
    assert_eq!(bucket.consume(1000), Duration::ZERO);
    let wait = bucket.consume(1000); // Beyond burst capacity: wait about one second.
    assert!(wait >= Duration::from_millis(999));
  }

  #[test]
  fn refills_over_time() {
    let bucket = TokenBucket::new(1000, 1000);
    assert_eq!(bucket.consume(1000), Duration::ZERO); // Exhaust burst capacity.
    assert!(bucket.consume(100) > Duration::from_millis(90)); // About 100 ms for 100 bytes.
    std::thread::sleep(Duration::from_millis(200));
    assert_eq!(bucket.consume(100), Duration::ZERO); // After 200 ms, 200 tokens have accrued.
  }
}
