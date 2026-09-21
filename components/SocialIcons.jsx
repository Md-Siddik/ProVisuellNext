"use client"

// Small fixed icon set for common social platforms, matched by name
// (case-insensitive) against the CMS item's "platform" field — so an admin
// typing "Instagram" gets the Instagram glyph automatically. Anything that
// doesn't match falls back to a generic link icon rather than breaking.
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.9" />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.9" />
    <circle cx="17.5" cy="6.6" r="1.1" fill="currentColor" />
  </svg>
)

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path
      d="M15.5 8.5h-2c-.4 0-1 .3-1 1V12h3l-.4 3h-2.6v7h-3v-7H8v-3h2.5v-2.2c0-2.4 1.5-3.8 3.8-3.8H16v3z"
      fill="currentColor"
    />
  </svg>
)

const LinkedinIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path d="M5.2 7.3H1.8V22H5.2V7.3ZM3.5 1.9C2.4 1.9 1.5 2.8 1.5 3.9C1.5 5 2.4 5.9 3.5 5.9C4.6 5.9 5.5 5 5.5 3.9C5.5 2.8 4.6 1.9 3.5 1.9ZM22.5 13.6C22.5 9.2 20.2 7 17.1 7C14.6 7 13.5 8.4 12.9 9.4V7.3H9.5C9.5 8.7 9.5 22 9.5 22H12.9V13.8C12.9 13.4 12.9 12.9 13.1 12.6C13.5 11.7 14.3 10.8 15.8 10.8C17.7 10.8 18.5 12.3 18.5 14.5V22H21.9V14.1C21.9 13.9 21.9 13.7 21.9 13.6H22.5Z" />
  </svg>
)

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path d="M18.9 2H22l-7.6 8.7L23.3 22h-7l-5.5-7.2L4.5 22H1.4l8.1-9.3L1 2h7.2l5 6.6L18.9 2zm-1.2 18h1.7L6.4 4H4.6l13.1 16z" />
  </svg>
)

const YoutubeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <rect x="2" y="5.5" width="20" height="13" rx="4" stroke="currentColor" strokeWidth="1.8" />
    <path d="M10.5 9.5L15 12L10.5 14.5V9.5Z" fill="currentColor" />
  </svg>
)

const TiktokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path d="M16.5 2c.4 2.3 1.9 3.9 4.3 4.1v2.8c-1.5.1-2.9-.4-4.3-1.3v6.7c0 3.4-2.7 5.7-5.8 5.7-3.4 0-5.9-2.6-5.9-5.7 0-3.4 2.9-6 6.4-5.6v3c-.3-.1-.6-.1-.9-.1-1.6 0-2.9 1.2-2.9 2.9 0 1.6 1.3 2.8 2.9 2.8 1.7 0 3.1-1.3 3.1-3.4V2h3.1z" />
  </svg>
)

const PinterestIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path d="M12 2C6.5 2 3 5.9 3 10.3c0 2.7 1.4 4.8 3.5 5.6.3.1.6 0 .7-.4l.3-1.2c.1-.3 0-.5-.2-.8-.5-.6-.9-1.5-.9-2.8 0-3.6 2.7-6.7 6.9-6.7 3.7 0 5.8 2.2 5.8 5.3 0 4-1.8 7.2-4.4 7.2-1.4 0-2.5-1.2-2.2-2.7.4-1.8 1.3-3.7 1.3-5 0-1.2-.6-2.1-1.9-2.1-1.5 0-2.7 1.6-2.7 3.6 0 1.3.5 2.2.5 2.2s-1.6 6.5-1.8 7.6c-.4 1.6-.1 3.6 0 3.8.1.1.2.1.3 0 .1-.1 1.6-1.9 2.1-3.7.1-.5.6-2.3.6-2.3.3.6 1.3 1.1 2.3 1.1 3.1 0 5.4-2.8 5.4-6.7C21 5.7 17.7 2 12 2z" />
  </svg>
)

const WhatsappIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path
      d="M12 3C7 3 3 7 3 12c0 1.7.5 3.3 1.3 4.7L3 21l4.5-1.2C8.8 20.5 10.4 21 12 21c5 0 9-4 9-9s-4-9-9-9z"
      stroke="currentColor"
      strokeWidth="1.7"
    />
    <path
      d="M8.5 8.8c.2-.5.5-.5.8-.5h.6c.2 0 .4 0 .6.4.2.5.7 1.6.7 1.7.1.1.1.3 0 .4-.1.2-.2.3-.3.4-.1.1-.3.3-.4.4-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.5 1.5.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.2.3-.2.6-.1.2.1 1.5.7 1.8.8.3.1.4.2.5.3.1.2.1 1-.3 1.4-.4.4-1.5 1-2.6.9-1.4-.1-3-.7-4.6-2.2-1.8-1.6-2.9-3.4-3.1-4-.2-.6-.3-1.1-.1-1.5z"
      fill="currentColor"
    />
  </svg>
)

const TelegramIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M6.4 12.1l11.1-4.3c.5-.2.9.2.7.7l-2.4 8.6c-.1.5-.6.6-1 .3l-2.7-2-1.4 1.3c-.2.2-.5.1-.5-.2l-.3-2.7-3.3-1.2c-.5-.2-.5-.7.2-.5z"
      fill="currentColor"
    />
  </svg>
)

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path d="M18.9 5.3a17.9 17.9 0 0 0-4.5-1.4c-.2.4-.4.9-.6 1.3a16.6 16.6 0 0 0-4.6 0 9 9 0 0 0-.6-1.3 17.9 17.9 0 0 0-4.5 1.4C1.7 9 1 12.6 1.3 16.1a18 18 0 0 0 5.5 2.8c.4-.6.8-1.2 1.1-1.9-.6-.2-1.2-.5-1.8-.9.2-.1.3-.2.4-.3 3.5 1.6 7.3 1.6 10.8 0 .1.1.3.2.4.3-.6.3-1.2.6-1.8.9.3.7.7 1.3 1.1 1.9a17.9 17.9 0 0 0 5.5-2.8c.4-4-.6-7.6-2.6-10.8zM8.7 13.9c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2zm6.6 0c-.9 0-1.7-.9-1.7-2s.8-2 1.7-2 1.7.9 1.7 2-.8 2-1.7 2z" />
  </svg>
)

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path
      d="M12 3c3 0 5 2.3 5 5.4 0 1 0 2 .1 2.6.6.2 1.4.5 1.9.9.3.3.2.7-.2.8-.5.2-1 .3-1.3.5-.1.4 0 .8.3 1.2.6.8 1.6 1.3 2.5 1.5.3.1.4.4.2.7-.4.6-1.4.9-2.1 1-.1.3-.2.7-.4 1-.2.3-.6.3-1 .2-.6-.1-1.2-.1-1.7.1-.6.3-1.1.9-2 1.4-.8.5-1.5.7-2.3.7s-1.5-.2-2.3-.7c-.9-.5-1.4-1.1-2-1.4-.5-.2-1.1-.2-1.7-.1-.4.1-.8.1-1-.2-.2-.3-.3-.7-.4-1-.7-.1-1.7-.4-2.1-1-.2-.3-.1-.6.2-.7.9-.2 1.9-.7 2.5-1.5.3-.4.4-.8.3-1.2-.3-.2-.8-.3-1.3-.5-.4-.1-.5-.5-.2-.8.5-.4 1.3-.7 1.9-.9.1-.6.1-1.6.1-2.6C7 5.3 9 3 12 3z"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinejoin="round"
    />
  </svg>
)

const ThreadsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path
      d="M12 3c-4.5 0-7 3-7 7.5v3C5 18 7.5 21 12 21c4 0 6.5-2.2 6.9-5.3.3-2.4-.9-4-3.2-4.4-1.8-.3-3.2.3-3.7 1.5-.3.8-.1 1.7.7 2.1.9.5 2 .1 2.3-.8"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const RedditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <circle cx="12" cy="13.5" r="7" stroke="currentColor" strokeWidth="1.7" />
    <circle cx="9" cy="13.5" r="1.1" fill="currentColor" />
    <circle cx="15" cy="13.5" r="1.1" fill="currentColor" />
    <path d="M8.5 16.5c1 .8 2.2 1.2 3.5 1.2s2.5-.4 3.5-1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15.5 8.5l2-2.3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <circle cx="17.5" cy="5" r="1.3" stroke="currentColor" strokeWidth="1.3" />
  </svg>
)

const TwitchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path d="M5 4h15v10.5l-4 4h-4l-2.5 2.5H8v-2.5H5V4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <path d="M13 8v4M17.5 8v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
)

const GithubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path d="M12 2C6.5 2 2 6.6 2 12.2c0 4.5 2.9 8.3 6.8 9.6.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.3-3.4-1.3-.4-1.1-1-1.4-1-1.4-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.3 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .5 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .3.3.6.8.6 1.7v2.5c0 .3.2.6.7.5 4-1.3 6.8-5.1 6.8-9.6C22 6.6 17.5 2 12 2z" />
  </svg>
)

const VimeoIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path d="M22 7.4c-.1 2.2-1.6 5.2-4.7 9-3.2 3.9-5.9 5.9-8.1 5.9-1.4 0-2.5-1.3-3.5-3.8C4.8 15.6 4 12.1 2.8 11c-.3-.3-1.2.3-2.8 1.7l-1-1.3c1.8-1.6 3.6-3.3 5.2-4.9C6.3 5 7.4 4.6 8.2 4.7c1.9.2 3.1 1.5 3.6 4 .5 2.7.9 4.4 1.2 5 .3.9.7 1.3 1.2 1.3.4 0 1-.6 1.8-1.9.8-1.3 1.2-2.2 1.3-2.9.1-1.1-.3-1.7-1.3-1.7-.5 0-.9.1-1.4.3.9-3 2.7-4.5 5.3-4.4 1.9.1 2.8 1.3 2.7 3.6z" />
  </svg>
)

const BehanceIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path d="M3 6h5.3c1.3 0 2.3.3 2.9.9.6.6.9 1.3.9 2.2 0 .6-.2 1.2-.5 1.6-.3.4-.7.7-1.2.9.7.2 1.2.6 1.6 1.1.4.5.6 1.2.6 2 0 1-.4 1.9-1.1 2.5-.7.6-1.7.9-3 .9H3V6zm2.5 5h2.4c.6 0 1-.1 1.3-.4.3-.2.4-.6.4-1s-.1-.7-.4-1c-.3-.2-.7-.4-1.3-.4H5.5v2.8zm0 5.3h2.7c.7 0 1.2-.1 1.5-.4.3-.3.5-.7.5-1.2s-.2-.9-.5-1.2c-.3-.3-.8-.4-1.5-.4H5.5v3.2zM14 9.5h6v1.3h-6z" />
    <path d="M17 12.3c-2.1 0-3.6 1.5-3.6 3.7 0 2.3 1.5 3.7 3.7 3.7 1.6 0 2.7-.7 3.3-2l-1.7-.6c-.3.6-.8.9-1.5.9-1 0-1.6-.6-1.7-1.6h5v-.6c0-2.3-1.4-3.5-3.5-3.5zm-1.5 2.9c.2-.9.7-1.4 1.5-1.4.8 0 1.3.5 1.4 1.4h-2.9z" />
  </svg>
)

const DribbbleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M4 9.5c2.8.9 8.5 1.6 15.3.3M4.8 16.5c2-3.6 6-8.5 6.4-13M12.8 3.3c2.6 3 6 8.7 6.4 15.3"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
    />
  </svg>
)

const SpotifyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
    <path d="M7 10c3.5-1 7-.7 9.7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M7.5 13c2.8-.8 5.8-.5 8 .8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 16c2.2-.6 4.5-.4 6.2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const MessengerIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path
      d="M12 3C6.9 3 3 6.6 3 11.4c0 2.7 1.3 5.1 3.3 6.7V21l3-1.7c.9.3 1.8.4 2.7.4 5.1 0 9-3.6 9-8.3S17.1 3 12 3z"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
    <path d="M7.5 12.5l3.3-3.5 2.3 2.3 3.4-3.6-3.3 5.3-2.3-2.3-3.4 3.8z" fill="currentColor" />
  </svg>
)

const MastodonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path
      d="M17 4.5c-3.3-.8-6.7-.8-10 0C5.7 5 5 6.3 5 8v5.5c0 3 2.2 4.7 5 4.9v2.6l3-2.6c3-.1 5.5-1.9 5.5-4.9V8c0-1.7-.7-3-2.5-3.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M9 8.5v4M15 8.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const EmailIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <rect x="3" y="5.5" width="18" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const WebsiteIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
    <path
      d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3z"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
)

const GenericLinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-[19px] w-[19px]">
    <path
      d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.54 3.54 0 0 0-5-5l-1 1"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.54 3.54 0 0 0 5 5l1-1"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const ICONS_BY_PLATFORM = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  linkedin: LinkedinIcon,
  twitter: XIcon,
  x: XIcon,
  youtube: YoutubeIcon,
  tiktok: TiktokIcon,
  pinterest: PinterestIcon,
  whatsapp: WhatsappIcon,
  telegram: TelegramIcon,
  discord: DiscordIcon,
  snapchat: SnapchatIcon,
  threads: ThreadsIcon,
  reddit: RedditIcon,
  twitch: TwitchIcon,
  github: GithubIcon,
  vimeo: VimeoIcon,
  behance: BehanceIcon,
  dribbble: DribbbleIcon,
  spotify: SpotifyIcon,
  messenger: MessengerIcon,
  mastodon: MastodonIcon,
  email: EmailIcon,
  website: WebsiteIcon,
  other: GenericLinkIcon,
}

// The picker shown in the Website Editor when adding/editing a social link —
// an admin picks one of these instead of typing a platform name and hoping
// it matches. `key` is what gets stored on the item (in its `image` field,
// piggy-backing on the slot every other collection uses for a picked asset)
// and is matched back to a glyph via ICONS_BY_PLATFORM.
export const SOCIAL_ICON_OPTIONS = [
  { key: "instagram", label: "Instagram", Icon: InstagramIcon },
  { key: "facebook", label: "Facebook", Icon: FacebookIcon },
  { key: "x", label: "X / Twitter", Icon: XIcon },
  { key: "linkedin", label: "LinkedIn", Icon: LinkedinIcon },
  { key: "youtube", label: "YouTube", Icon: YoutubeIcon },
  { key: "tiktok", label: "TikTok", Icon: TiktokIcon },
  { key: "pinterest", label: "Pinterest", Icon: PinterestIcon },
  { key: "whatsapp", label: "WhatsApp", Icon: WhatsappIcon },
  { key: "telegram", label: "Telegram", Icon: TelegramIcon },
  { key: "discord", label: "Discord", Icon: DiscordIcon },
  { key: "snapchat", label: "Snapchat", Icon: SnapchatIcon },
  { key: "threads", label: "Threads", Icon: ThreadsIcon },
  { key: "reddit", label: "Reddit", Icon: RedditIcon },
  { key: "twitch", label: "Twitch", Icon: TwitchIcon },
  { key: "github", label: "GitHub", Icon: GithubIcon },
  { key: "vimeo", label: "Vimeo", Icon: VimeoIcon },
  { key: "behance", label: "Behance", Icon: BehanceIcon },
  { key: "dribbble", label: "Dribbble", Icon: DribbbleIcon },
  { key: "spotify", label: "Spotify", Icon: SpotifyIcon },
  { key: "messenger", label: "Messenger", Icon: MessengerIcon },
  { key: "mastodon", label: "Mastodon", Icon: MastodonIcon },
  { key: "email", label: "Email", Icon: EmailIcon },
  { key: "website", label: "Website", Icon: WebsiteIcon },
  { key: "other", label: "Other", Icon: GenericLinkIcon },
]

// `icon` is the explicit choice from the picker above; falls back to
// matching the free-text `platform` field (older items saved before the
// picker existed), then to a generic link glyph.
export function SocialIcon({ platform, icon }) {
  const Icon =
    ICONS_BY_PLATFORM[(icon || "").trim().toLowerCase()] ||
    ICONS_BY_PLATFORM[(platform || "").trim().toLowerCase()] ||
    GenericLinkIcon
  return <Icon />
}