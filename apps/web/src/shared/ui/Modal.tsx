import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  maxWidth?: string;
  children: ReactNode;
  onClose: () => void;
};

export function Modal({ open, title, description, maxWidth = "max-w-2xl", children, onClose }: ModalProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className={`my-0 max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto ${maxWidth} rounded-3xl border border-white/10 bg-[#0C0D12] p-4 text-white shadow-2xl shadow-black/40 sm:my-auto sm:max-h-[calc(100dvh-2rem)] sm:p-6`}
            initial={{ y: 20, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-white">{title}</h3>
                {description ? <p className="mt-1 text-sm text-zinc-400">{description}</p> : null}
              </div>
              <button onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 transition hover:bg-white/10 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
