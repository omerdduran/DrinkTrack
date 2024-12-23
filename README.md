# DrinkTrack

A modern and intuitive water intake tracking application built with React Native and Expo.

## Features

- 💧 Track daily water and beverage intake
- 📊 View detailed history and statistics
- 🎯 Set and monitor daily hydration goals
- ⏰ Customizable reminder notifications
- 🌙 Dark/Light mode support
- 🌍 Multi-language support (English, Turkish)
- 🔄 Custom day reset time
- 📱 Home screen widget support
- 🍺 Multiple beverage type tracking
- 📈 Weekly and monthly progress views
- 💾 Data export/import functionality

## Upcoming Features

- 🏃‍♂️ Activity-based hydration recommendations
- 🌡️ Weather-based intake suggestions
- 🎨 Custom themes
- 🎨 Icon and color customization
- 🔔 Smart notification system
- ⌚ Smartwatch integration
- 🌐 Support for more languages
- 📱 Widget support (iOS and Android)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/omerdduran/DrinkTrack.git
```

2. Install dependencies:
```bash
cd DrinkTrack
npm install
```

3. Start the development server:
```bash
npx expo start
```

## Building the App

### Development Build
```bash
eas build --profile development --platform ios
# or
eas build --profile development --platform android
```

### Production Build
```bash
eas build --profile production --platform ios
# or
eas build --profile production --platform android
```

## Tech Stack

- React Native
- Expo
- TypeScript
- AsyncStorage
- Expo Notifications
- React Native Reanimated
- React Native SVG

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Translations

We welcome translations for DrinkTrack! If you'd like to contribute by adding support for your language:

1. Fork the repository
2. Copy the `translations/en.ts` file
3. Create a new file in the `translations` folder for your language (e.g., `fr.ts` for French)
4. Translate the strings in the new file
5. Add your language code to `translations/types.ts`
6. Submit a Pull Request

Currently supported languages:
- English (en)
- Turkish (tr)

## License

This project is licensed under the GNU General Public License - see the LICENSE file for details.

## Support

If you encounter any issues or have questions, please file an issue on the GitHub repository.

## Acknowledgments

- Thanks to all contributors who have helped shape DrinkTrack
- Special thanks to the React Native and Expo communities
- Thanks to our translators who help make DrinkTrack accessible to more users

---

Made with 💧 by [Ömer Duran](https://github.com/omerdduran)
