import {
  ArrowDataTransferHorizontalIcon,
  BubbleChatQuestionIcon,
  CheckListIcon,
  File02Icon,
  HelpCircleIcon,
  Home01Icon,
  InformationCircleIcon,
  Megaphone01Icon,
  SmartPhone01Icon,
} from "@hugeicons/core-free-icons"

/**
 * Ikon per tujuan navigasi publik (CD-01). Alasan tiap ikon (antislop R-04):
 * rumah = beranda, ponsel = katalog HP, dua panah berlawanan = menyandingkan,
 * gelembung tanya = tanya jawab AI (bukan ikon "sparkle"), lingkar info =
 * cara kerja dan sumber data, daftar centang = daftar per kebutuhan, tanda
 * tanya = pertanyaan umum, pengeras suara = iklan, dokumen = ketentuan.
 */
export const NAV_ICONS: Record<string, typeof Home01Icon> = {
  "/": Home01Icon,
  "/products": SmartPhone01Icon,
  "/compare": ArrowDataTransferHorizontalIcon,
  "/assistant": BubbleChatQuestionIcon,
  "/how-it-works": InformationCircleIcon,
  "/hp": CheckListIcon,
  "/faq": HelpCircleIcon,
  "/iklan": Megaphone01Icon,
  "/terms": File02Icon,
}
