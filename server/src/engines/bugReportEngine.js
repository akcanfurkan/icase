/**
 * Rule-Based Bug Report Generator
 * Generates structured bug reports based on error description keywords.
 */

function generateBugReport(errorDescription) {
  const text = errorDescription.toLowerCase();

  let severity = 'Medium';
  let priority = 'Medium';

  // Determine severity based on keywords
  if (text.includes('crash') || text.includes('data loss') || text.includes('security') || text.includes('down')) {
    severity = 'Critical';
    priority = 'Critical';
  } else if (text.includes('error') || text.includes('fail') || text.includes('broken') || text.includes('cannot')) {
    severity = 'High';
    priority = 'High';
  } else if (text.includes('slow') || text.includes('delay') || text.includes('performance')) {
    severity = 'Medium';
    priority = 'Medium';
  } else if (text.includes('typo') || text.includes('alignment') || text.includes('color') || text.includes('font') || text.includes('ui')) {
    severity = 'Low';
    priority = 'Low';
  }

  // Generate title
  let title = '';
  if (text.includes('login')) {
    title = 'Login functionality issue';
  } else if (text.includes('payment') || text.includes('checkout')) {
    title = 'Payment/Checkout process issue';
  } else if (text.includes('page') && (text.includes('load') || text.includes('blank') || text.includes('white'))) {
    title = 'Page loading/display issue';
  } else if (text.includes('button') && (text.includes('not working') || text.includes('click') || text.includes('unresponsive'))) {
    title = 'Button interaction issue';
  } else if (text.includes('form') || text.includes('submit')) {
    title = 'Form submission issue';
  } else if (text.includes('api') || text.includes('500') || text.includes('server')) {
    title = 'Server/API error encountered';
  } else if (text.includes('mobile') || text.includes('responsive')) {
    title = 'Mobile/Responsive design issue';
  } else if (text.includes('upload')) {
    title = 'File upload issue';
  } else if (text.includes('search')) {
    title = 'Search functionality issue';
  } else if (text.includes('notification') || text.includes('email')) {
    title = 'Notification/Email issue';
  } else {
    // Generate from first sentence
    const firstSentence = errorDescription.split(/[.!?\n]/)[0].trim();
    title = firstSentence.length > 80 ? firstSentence.substring(0, 77) + '...' : firstSentence;
  }

  // Generate steps to reproduce
  let stepsToReproduce = '';
  if (text.includes('login')) {
    stepsToReproduce =
      '1. Navigate to the login page\n' +
      '2. Enter user credentials\n' +
      '3. Click the Login button\n' +
      '4. Observe the error/issue';
  } else if (text.includes('payment') || text.includes('checkout')) {
    stepsToReproduce =
      '1. Add items to the shopping cart\n' +
      '2. Proceed to checkout\n' +
      '3. Enter payment details\n' +
      '4. Click Pay/Submit\n' +
      '5. Observe the error/issue';
  } else if (text.includes('form') || text.includes('submit')) {
    stepsToReproduce =
      '1. Navigate to the form page\n' +
      '2. Fill in the form fields\n' +
      '3. Click Submit\n' +
      '4. Observe the error/issue';
  } else if (text.includes('upload')) {
    stepsToReproduce =
      '1. Navigate to the upload section\n' +
      '2. Select a file to upload\n' +
      '3. Click Upload\n' +
      '4. Observe the error/issue';
  } else if (text.includes('search')) {
    stepsToReproduce =
      '1. Navigate to the page with search functionality\n' +
      '2. Enter a search query\n' +
      '3. Press Enter or click Search\n' +
      '4. Observe the error/issue';
  } else if (text.includes('page') || text.includes('navigation')) {
    stepsToReproduce =
      '1. Open the application\n' +
      '2. Navigate to the affected page\n' +
      '3. Observe the error/issue';
  } else {
    stepsToReproduce =
      '1. Open the application\n' +
      '2. Navigate to the affected feature/page\n' +
      '3. Perform the action that triggers the issue\n' +
      '4. Observe the error/issue';
  }

  // Generate actual and expected results
  let actualResult = '';
  let expectedResult = '';

  if (text.includes('crash')) {
    actualResult = 'The application crashes unexpectedly';
    expectedResult = 'The application should handle the action gracefully without crashing';
  } else if (text.includes('blank') || text.includes('white page') || text.includes('not loading')) {
    actualResult = 'The page appears blank or fails to load content';
    expectedResult = 'The page should load with all content displayed correctly';
  } else if (text.includes('error') || text.includes('500')) {
    actualResult = 'An error message or HTTP 500 error is displayed';
    expectedResult = 'The operation should complete successfully without errors';
  } else if (text.includes('slow') || text.includes('performance')) {
    actualResult = 'The action takes an unacceptably long time to complete';
    expectedResult = 'The action should complete within acceptable response time (< 3 seconds)';
  } else if (text.includes('not working') || text.includes('broken')) {
    actualResult = 'The feature/component is non-functional';
    expectedResult = 'The feature/component should work as specified in the requirements';
  } else {
    actualResult = `Issue observed: ${errorDescription.substring(0, 200)}`;
    expectedResult = 'The feature should work correctly as per the requirements and user expectations';
  }

  return {
    title,
    steps_to_reproduce: stepsToReproduce,
    actual_result: actualResult,
    expected_result: expectedResult,
    severity,
    priority,
    status: 'Open',
  };
}

module.exports = { generateBugReport };

