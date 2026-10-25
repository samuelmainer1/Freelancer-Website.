import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext.jsx';
import Avatar from '../components/Avatar.jsx';

const input =
  'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const label = 'block text-sm font-semibold text-slate-700';

// Read an image file and downscale it to a small square JPEG data URL
function readSquare(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file is not a valid image.'));
      img.onload = () => {
        const SIZE = 320;
        const canvas = document.createElement('canvas');
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          SIZE,
          SIZE
        );
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function EditProfile() {
  const { user, token, refreshUser } = useAuth();
  const [form, setForm] = useState(null);
  const [avatar, setAvatar] = useState(undefined); // undefined = unchanged, string = new photo, null = removed
  const fileRef = useRef(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api(`/users/${user.id}`)
      .then((d) => {
        if (!alive) return;
        setForm({
          headline: d.profile.headline || '',
          location: d.profile.location || '',
          website: d.profile.website || '',
          company: d.profile.company || '',
          bio: d.profile.bio || '',
          skills: d.profile.skills.join(', '),
          hourly_rate: d.profile.hourly_rate ?? '',
          portfolio: d.profile.portfolio || '',
          is_public: d.profile.is_public !== 0,
        });
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [user.id]);

  if (error && !form) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-rose-600">{error}</div>;
  }
  if (!form) {
    return <div className="grid min-h-[50vh] place-items-center text-slate-400">Loading…</div>;
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const body = avatar === undefined ? form : { ...form, avatar };
      const d = await api('/users/me', { method: 'PUT', token, body });
      setAvatar(undefined);
      await refreshUser();
      setNotice('Profile updated! Your changes are live.');
      window.scrollTo(0, 0);
      return d;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Edit profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        Signed in as <strong>{user.name}</strong> ({user.role}). A complete profile builds trust
        and wins more jobs.
      </p>

      {notice && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form
        onSubmit={save}
        className="mt-6 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {/* Profile photo */}
        <div className="flex items-center gap-4">
          <Avatar
            id={user.id}
            name={user.name}
            src={avatar === undefined ? user.avatar : avatar}
            size="lg"
          />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {avatar === null ? 'Upload photo' : 'Change photo'}
              </button>
              {(avatar !== null && (avatar || user.avatar)) && (
                <button
                  type="button"
                  onClick={() => setAvatar(null)}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">JPG, PNG, GIF or WebP — cropped to a square.</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setError('');
                try {
                  setAvatar(await readSquare(file));
                } catch (err) {
                  setError(err.message);
                }
              }}
            />
          </div>
        </div>

        <div>
          <label className={label} htmlFor="headline">
            Headline
          </label>
          <input
            id="headline"
            className={`${input} mt-1`}
            value={form.headline}
            onChange={set('headline')}
            maxLength={120}
            placeholder={
              user.role === 'freelancer'
                ? 'e.g. Full-stack developer — React & Node'
                : 'e.g. Product lead hiring great builders'
            }
          />
        </div>

        <div>
          <label className={label} htmlFor="location">
            Location
          </label>
          <input
            id="location"
            className={`${input} mt-1`}
            value={form.location}
            onChange={set('location')}
            maxLength={80}
            placeholder="City, State/Province"
          />
        </div>
        {user.role === 'freelancer' ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="skills">
                Skills <span className="font-normal text-slate-400">(comma separated)</span>
              </label>
              <input
                id="skills"
                className={`${input} mt-1`}
                value={form.skills}
                onChange={set('skills')}
                placeholder="React, TypeScript, Node.js"
              />
            </div>
            <div>
              <label className={label} htmlFor="rate">
                Hourly rate (USD)
              </label>
              <input
                id="rate"
                type="number"
                min="0"
                step="1"
                className={`${input} mt-1`}
                value={form.hourly_rate}
                onChange={set('hourly_rate')}
                placeholder="50"
              />
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="company">
                Company
              </label>
              <input
                id="company"
                className={`${input} mt-1`}
                value={form.company}
                onChange={set('company')}
                maxLength={120}
                placeholder="Acme Inc."
              />
            </div>
            <div>
              <label className={label} htmlFor="website">
                Website
              </label>
              <input
                id="website"
                className={`${input} mt-1`}
                value={form.website}
                onChange={set('website')}
                placeholder="https://acme.com"
              />
            </div>
          </div>
        )}

        {user.role === 'freelancer' && (
          <div>
            <label className={label} htmlFor="portfolio">
              Portfolio links{' '}
              <span className="font-normal text-slate-400">
                (comma separated — e.g. GitHub: https://…, Site: https://…)
              </span>
            </label>
            <textarea
              id="portfolio"
              rows={2}
              className={`${input} mt-1 resize-y`}
              value={form.portfolio}
              onChange={set('portfolio')}
              maxLength={800}
              placeholder="GitHub: https://github.com/you, Portfolio: https://you.dev"
            />
          </div>
        )}

        {user.role === 'freelancer' && (
          <label
            htmlFor="is_public"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <input
              id="is_public"
              type="checkbox"
              checked={form.is_public}
              onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              className="mt-0.5 h-4 w-4 accent-emerald-600"
            />
            <span className="text-sm">
              <span className="font-medium text-slate-800">Show me in the freelancer directory</span>
              <span className="mt-0.5 block text-xs text-slate-500">
                When off, clients can't find you in search — your profile still works for people
                you've messaged or bid with.
              </span>
            </span>
          </label>
        )}

        <div>
          <label className={label} htmlFor="bio">
            About
          </label>
          <textarea
            id="bio"
            rows={6}
            className={`${input} mt-1 resize-y`}
            value={form.bio}
            onChange={set('bio')}
            maxLength={2000}
            placeholder={
              user.role === 'freelancer'
                ? 'Describe your experience, past work and what makes you great to work with…'
                : 'Tell freelancers about your company and the kind of work you post…'
            }
          />
          <p className="mt-1 text-right text-xs text-slate-400">{form.bio.length}/2000</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <Link
            to={`/users/${user.id}`}
            className="text-sm font-semibold text-slate-500 transition hover:text-slate-700"
          >
            View public profile →
          </Link>
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}