//! Synchronous token-bucket rate limiter for poll-based readers.
//!
//! Independent of `tokio::time`, `consume(n)` returns the required delay. The caller
//! (`DownloadReader`) drives a Sleep, matching the polling semantics of `AsyncRead`.

use std::sync::Mutex;
use std::time::{Duration, Instant};

struct TokenState {
  /// Currently accumulated byte tokens, capped by `capacity`.
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

  /// Consumes `n` bytes and returns the required delay.
  /// Tokens may become negative, so refills during the delay first repay the deficit. Each delay
  /// therefore accounts for exactly one read and keeps throughput at the configured rate.
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
    st.tokens -= need; // Allow a deficit so the next refill repays it first.
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
    let wait = bucket.consume(1000); // Exceeds capacity and requires a 1 s delay.
    assert!(wait >= Duration::from_millis(999));
  }

  #[test]
  fn refills_over_time() {
    let bucket = TokenBucket::new(1000, 1000);
    assert_eq!(bucket.consume(1000), Duration::ZERO); // Exhaust the burst capacity.
    assert!(bucket.consume(100) > Duration::from_millis(90)); // Empty bucket: wait about 100 ms.
    std::thread::sleep(Duration::from_millis(200));
    assert_eq!(bucket.consume(100), Duration::ZERO); // 200 ms accumulated 200 tokens.
  }
}
