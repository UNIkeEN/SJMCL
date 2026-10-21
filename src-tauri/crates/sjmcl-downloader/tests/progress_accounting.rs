use std::io;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Duration;

use bytes::Bytes;
use futures_util::{future::poll_fn, stream};
use sjmcl_downloader::TaskReport;
use sjmcl_downloader::download::DownloadReader;
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::sync::mpsc;
use tokio_util::io::StreamReader;
use tokio_util::sync::CancellationToken;

#[tokio::test]
async fn prefilled_buffers_count_only_newly_read_bytes() {
  for offset in [0, 123] {
    let payload = b"new bytes";
    let total = offset + payload.len() as u64;
    let (report, mut reports) = mpsc::channel(8);
    let mut reader = DownloadReader::new(
      payload.as_slice(),
      "t1".into(),
      CancellationToken::new(),
      Some(report),
      Duration::ZERO,
      offset,
      total,
      None,
    );
    let mut storage = [0; 64];
    let mut buffer = ReadBuf::new(&mut storage);
    buffer.put_slice(b"already buffered ");
    poll_fn(|cx| Pin::new(&mut reader).poll_read(cx, &mut buffer))
      .await
      .unwrap();

    assert_eq!(buffer.filled(), b"already buffered new bytes");
    assert_eq!(reader.offset(), total);
    assert!(matches!(
      reports.try_recv().unwrap(),
      TaskReport::Progress { received, total: reported_total, .. }
        if received == total && reported_total == total
    ));
  }
}

#[tokio::test]
async fn eof_with_buffered_bytes_does_not_report_more_progress() {
  let (report, mut reports) = mpsc::channel(8);
  let mut reader = DownloadReader::new(
    tokio::io::empty(),
    "t1".into(),
    CancellationToken::new(),
    Some(report),
    Duration::ZERO,
    123,
    123,
    None,
  );
  let mut storage = [0; 64];
  let mut buffer = ReadBuf::new(&mut storage);
  buffer.put_slice(b"already buffered");
  poll_fn(|cx| Pin::new(&mut reader).poll_read(cx, &mut buffer))
    .await
    .unwrap();

  assert_eq!(reader.offset(), 123);
  assert_eq!(buffer.filled(), b"already buffered");
  assert!(matches!(
    reports.try_recv(),
    Err(mpsc::error::TryRecvError::Empty)
  ));
}

#[derive(Default)]
struct BackpressuredWriter {
  bytes: Vec<u8>,
  ready: bool,
  waits: usize,
}

impl AsyncWrite for BackpressuredWriter {
  fn poll_write(
    mut self: Pin<&mut Self>,
    cx: &mut Context<'_>,
    buf: &[u8],
  ) -> Poll<io::Result<usize>> {
    if !self.ready {
      self.ready = true;
      self.waits += 1;
      cx.waker().wake_by_ref();
      return Poll::Pending;
    }
    self.ready = false;
    self.bytes.extend_from_slice(buf);
    Poll::Ready(Ok(buf.len()))
  }

  fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
    Poll::Ready(Ok(()))
  }

  fn poll_shutdown(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
    Poll::Ready(Ok(()))
  }
}

#[tokio::test]
async fn copy_under_write_backpressure_keeps_progress_equal_to_actual_bytes() {
  let body: Vec<u8> = (0..20000).map(|index| (index % 251) as u8).collect();
  for offset in [0, 123] {
    let total = offset + body.len() as u64;
    let chunks = stream::iter(
      body
        .chunks(257)
        .map(|chunk| Ok::<_, io::Error>(Bytes::copy_from_slice(chunk))),
    );
    let (report, mut reports) = mpsc::channel(128);
    let mut reader = DownloadReader::new(
      StreamReader::new(chunks),
      "t1".into(),
      CancellationToken::new(),
      Some(report),
      Duration::ZERO,
      offset,
      total,
      None,
    );
    let mut writer = BackpressuredWriter::default();
    let copied = tokio::io::copy(&mut reader, &mut writer).await.unwrap();

    assert!(writer.waits > 0);
    assert_eq!(writer.bytes, body);
    assert_eq!(copied, body.len() as u64);
    assert_eq!(reader.offset(), total);
    let mut previous = offset;
    while let Ok(report) = reports.try_recv() {
      if let TaskReport::Progress {
        received,
        total: reported_total,
        ..
      } = report
      {
        assert!(received > previous);
        assert!(received <= total);
        assert_eq!(reported_total, total);
        previous = received;
      }
    }
    assert_eq!(previous, total);
  }
}
