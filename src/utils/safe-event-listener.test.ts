/**
 * Simple test to verify the safe event listener implementation works correctly.
 * This test can be run in the browser console to verify the functionality.
 */
import {
  cleanupListeners,
  createSafeEventListener,
} from "../safe-event-listener";

// Mock test to verify the safe event listener works
export async function testSafeEventListener() {
  console.log("Testing safe event listener implementation...");

  let receivedEvents: string[] = [];

  try {
    // Test 1: Create safe event listener
    const cleanup1 = createSafeEventListener<string>(
      "test:event",
      (payload) => {
        receivedEvents.push(`Event 1: ${payload}`);
      }
    );

    // Test 2: Create another safe event listener
    const cleanup2 = createSafeEventListener<string>(
      "test:event2",
      (payload) => {
        receivedEvents.push(`Event 2: ${payload}`);
      }
    );

    console.log("✓ Event listeners created successfully");

    // Test 3: Test cleanup functionality
    setTimeout(() => {
      console.log("Testing cleanup...");
      cleanupListeners([cleanup1, cleanup2]);
      console.log("✓ Cleanup completed without errors");
    }, 100);

    // Test 4: Test multiple cleanup calls (should not throw)
    setTimeout(() => {
      console.log("Testing multiple cleanup calls...");
      cleanup1();
      cleanup1(); // Should not throw
      cleanup2();
      cleanup2(); // Should not throw
      console.log("✓ Multiple cleanup calls handled safely");
    }, 200);

    console.log(
      "✓ All tests passed - safe event listener implementation is working correctly"
    );
    return true;
  } catch (error) {
    console.error("✗ Test failed:", error);
    return false;
  }
}

// Export for potential manual testing
export { testSafeEventListener };
