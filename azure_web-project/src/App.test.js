import { render, screen } from '@testing-library/react';
import AzureWeb from './azure_web';

test('renders Azure IoT Hub header', () => {
  render(<AzureWeb />);
  const titleElement = screen.getByText(/Azure IoT Hub/i);
  expect(titleElement).toBeInTheDocument();
});
