import { Resend } from 'resend'

export const resend = new Resend(process.env.RESEND_API_KEY)

export const sendEmail = async ({
  to,
  subject,
  html,
  attachments,
}: {
  to: string
  subject: string
  html: string
  attachments?: Array<{ filename: string; content: Buffer }>
}) => {
  try {
    const data = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: [to],
      subject,
      html,
      ...(attachments?.length ? { attachments } : {}),
    })

    return { success: true, data }
  } catch (error) {
    console.error('Error sending email:', error)
    return { success: false, error }
  }
}
