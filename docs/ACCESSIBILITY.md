# Accessibility Guide - ARUS Marine Predictive Maintenance

## Keyboard Shortcuts

### Global Navigation

- **⌘+K** (Mac) / **Ctrl+K** (Windows/Linux): Open command palette for quick navigation
- **Tab**: Navigate forward through interactive elements
- **Shift+Tab**: Navigate backward through interactive elements
- **Enter**: Activate focused button or link
- **Escape**: Close open dialogs, modals, and menus
- **Skip to Content**: Press **Tab** on page load to reveal skip link, then **Enter** to jump to main content

### Command Palette (⌘+K / Ctrl+K)

- **Type**: Search for vessels, equipment, alerts, work orders, and more
- **Arrow Keys**: Navigate through search results
- **Enter**: Select highlighted item
- **Escape**: Close command palette

### Quick Actions Menu

- **Click FAB Button**: Toggle quick actions menu
- **Arrow Keys**: Navigate through available actions
- **Enter**: Select action
- **Escape**: Close menu

### Navigation

- **Home** ( `/` ): Dashboard
- **Shift+A**: Alerts page
- **Shift+V**: Vessel Management
- **Shift+E**: Equipment Registry
- **Shift+W**: Work Orders
- **Shift+M**: Maintenance Schedules

## Screen Reader Support

ARUS is designed to work with popular screen readers:

- **NVDA** (Windows)
- **JAWS** (Windows)
- **VoiceOver** (macOS/iOS)
- **TalkBack** (Android)

### Key Features for Screen Readers

- Semantic HTML structure with proper heading hierarchy
- ARIA labels on all interactive elements
- Descriptive link text and button labels
- Status announcements for dynamic content updates
- Form labels and error messages announced clearly

## Mobile Accessibility

### Touch Targets

- All interactive elements are minimum **44x44 pixels** for easy tapping
- Buttons optimized for thumb-zone on mobile devices
- Bottom navigation for one-handed mobile use

### Gestures

- **Swipe**: Navigate through horizontal tab lists
- **Tap**: Activate buttons and links
- **Double-tap**: Select items in lists

### Focus Mode

- Reduces visual clutter by showing only critical information
- Toggle with Focus Mode button in header
- Automatically highlights high-priority items

## Color and Contrast

- **WCAG 2.1 AA Compliant**: All text meets 4.5:1 contrast ratio
- **Color-blind Safe**: Important information conveyed through icons and text, not color alone
- **Dark Mode Support**: Automatic theme switching based on system preferences
- **High Contrast**: Custom color schemes available for visibility

## Forms and Error Handling

- **Clear Labels**: All form fields have visible, descriptive labels
- **Error Messages**: Inline validation with clear error descriptions
- **Required Fields**: Marked with asterisk (\*) and aria-required attribute
- **Focus Management**: Automatic focus on first error after form submission

## Known Limitations

1. **Charts and Graphs**: Complex visualizations have text alternatives and data tables
2. **Real-time Updates**: WebSocket updates announced via aria-live regions
3. **Drag-and-Drop**: Alternative keyboard-based sorting available

## Reporting Accessibility Issues

If you encounter accessibility barriers while using ARUS:

1. Note the page/feature where you encountered the issue
2. Describe the problem and your assistive technology setup
3. Contact support with details for prompt resolution

## Compliance

ARUS targets **WCAG 2.1 Level AA** compliance across all features:

- ✅ Perceivable: Information presented in multiple ways
- ✅ Operable: Keyboard and touch navigation support
- ✅ Understandable: Clear language and consistent behavior
- ✅ Robust: Compatible with assistive technologies

Last Updated: October 29, 2025
