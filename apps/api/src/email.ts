type EmailConfig = {
  resendApiKey?: string;
  from?: string;
};

type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type MagicLinkEmailInput = {
  email: string;
  url: string;
};

type VerificationEmailInput = {
  email: string;
  url: string;
};

type InvitationEmailInput = {
  email: string;
  orgName: string;
  inviterName?: string | null;
  role: string;
  url: string;
  expiresAt: Date;
};

const defaultFrom = 'LEVERIE <auth@leverie.dev>';

async function sendEmail(config: EmailConfig, input: SendEmailInput) {
  if (!config.resendApiKey) {
    console.info(`[email:dev] ${input.subject} -> ${input.to}\n${input.text}`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: config.from ?? defaultFrom,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend email failed: ${response.status} ${body}`);
  }
}

export async function sendMagicLinkEmail(
  config: EmailConfig,
  input: MagicLinkEmailInput,
) {
  await sendEmail(config, {
    to: input.email,
    subject: 'Sign in to LEVERIE',
    text: `Open this link to sign in to LEVERIE:\n\n${input.url}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Open this link to sign in to LEVERIE:</p><p><a href="${input.url}">Sign in to LEVERIE</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

export async function sendVerificationEmail(
  config: EmailConfig,
  input: VerificationEmailInput,
) {
  await sendEmail(config, {
    to: input.email,
    subject: 'Verify your LEVERIE email',
    text: `Confirm this email address to finish creating your LEVERIE account:\n\n${input.url}\n\nIf you did not request this, you can ignore this email — no account will be created.`,
    html: `<p>Confirm this email address to finish creating your LEVERIE account:</p><p><a href="${input.url}">Verify my email</a></p><p>If you did not request this, you can ignore this email — no account will be created.</p>`,
  });
}

export async function sendInvitationEmail(
  config: EmailConfig,
  input: InvitationEmailInput,
) {
  const inviter = input.inviterName
    ? `${input.inviterName} invited`
    : 'You were invited';
  const expiry = input.expiresAt.toISOString();

  await sendEmail(config, {
    to: input.email,
    subject: `Join ${input.orgName} on LEVERIE`,
    text: `${inviter} you to join ${input.orgName} on LEVERIE as ${input.role}.\n\nAccept the invitation:\n${input.url}\n\nThis invitation expires at ${expiry}.`,
    html: `<p>${inviter} you to join <strong>${input.orgName}</strong> on LEVERIE as <strong>${input.role}</strong>.</p><p><a href="${input.url}">Accept the invitation</a></p><p>This invitation expires at ${expiry}.</p>`,
  });
}
