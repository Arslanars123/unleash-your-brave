/// Static legal copy shown in-app from Profile → Settings.
abstract final class LegalCopy {
  static const privacyTitle = 'Privacy Policy';
  static const termsTitle = 'Terms & Conditions';

  static const privacyLastUpdated = 'August 7, 2026';
  static const termsLastUpdated = 'August 7, 2026';

  static const privacySections = <LegalSection>[
    LegalSection(
      heading: 'Overview',
      body:
          'Unleash Your Brave (“we”, “us”) provides an event experience app for attendees, speakers, and organizers. This Privacy Policy explains what information we collect, how we use it, and the choices you have.',
    ),
    LegalSection(
      heading: 'Information we collect',
      body:
          'Account details you provide (such as name, email, photo, title, business, and networking preferences), event activity (sessions you view, check-ins, chat messages, and announcement interactions), and device information needed to deliver push notifications (such as a device push token and platform).',
    ),
    LegalSection(
      heading: 'How we use information',
      body:
          'We use your information to operate the event app, personalize your agenda and membership experience, enable networking and group chat, send service and event announcements, improve reliability and security, and respond to support requests.',
    ),
    LegalSection(
      heading: 'Push notifications',
      body:
          'If you enable notifications, we may send chat alerts, announcements, and event reminders to your device. You can turn notifications off at any time in Profile → Settings. Turning them off unregisters your device from our push service.',
    ),
    LegalSection(
      heading: 'Sharing',
      body:
          'We share information with service providers who help us host the app, send email or push messages, and store media—only as needed to run the event. Profile details you choose to share (such as bio and social links) may be visible to other attendees according to event settings. We do not sell your personal information.',
    ),
    LegalSection(
      heading: 'Retention & security',
      body:
          'We retain account and event data for as long as needed to provide the event experience and meet operational or legal obligations. We use reasonable technical and organizational measures to protect your information, but no system is completely secure.',
    ),
    LegalSection(
      heading: 'Your choices',
      body:
          'You can update your profile in the app, disable push notifications, or sign out. To request account deletion or a copy of your data, contact the event organizers using the support channel provided for your event.',
    ),
    LegalSection(
      heading: 'Contact',
      body:
          'Questions about this Privacy Policy can be directed to the Unleash Your Brave event organizers through the official event communication channels.',
    ),
  ];

  static const termsSections = <LegalSection>[
    LegalSection(
      heading: 'Agreement',
      body:
          'By creating an account or using the Unleash Your Brave mobile app, you agree to these Terms & Conditions. If you do not agree, please do not use the app.',
    ),
    LegalSection(
      heading: 'Eligibility & accounts',
      body:
          'You must provide accurate registration details and keep your login credentials confidential. You are responsible for activity under your account. Organizers may suspend access for misuse, security risk, or violation of these terms.',
    ),
    LegalSection(
      heading: 'Event access',
      body:
          'Access to sessions, membership benefits, check-in, chat, and other features may depend on your ticket or membership tier and the rules set by event organizers. Features may change as the event schedule is updated.',
    ),
    LegalSection(
      heading: 'Acceptable use',
      body:
          'You agree not to harass others, post unlawful or abusive content, attempt to disrupt the service, scrape or misuse attendee data, or use the app for unauthorized commercial solicitation. Group chat and networking tools are for event-related interaction.',
    ),
    LegalSection(
      heading: 'Content you submit',
      body:
          'You retain ownership of content you submit (such as profile text, photos, and chat messages). You grant us a limited license to host and display that content as needed to operate the event app. Organizers may remove content that violates these terms or event policies.',
    ),
    LegalSection(
      heading: 'Notifications',
      body:
          'With your permission, the app may send push notifications about chat, announcements, and reminders. You can disable them in Profile → Settings. In-app notification history may still be available even when push delivery is off.',
    ),
    LegalSection(
      heading: 'Disclaimer',
      body:
          'The app is provided “as is” for the event experience. We do not guarantee uninterrupted availability. To the fullest extent permitted by law, we are not liable for indirect or consequential damages arising from use of the app.',
    ),
    LegalSection(
      heading: 'Changes',
      body:
          'We may update these Terms from time to time. Continued use of the app after changes become effective constitutes acceptance of the updated Terms. The “Last updated” date at the top of this page reflects the latest revision.',
    ),
    LegalSection(
      heading: 'Contact',
      body:
          'Questions about these Terms can be directed to the Unleash Your Brave event organizers through the official event communication channels.',
    ),
  ];
}

class LegalSection {
  const LegalSection({required this.heading, required this.body});

  final String heading;
  final String body;
}
