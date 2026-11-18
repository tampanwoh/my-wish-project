# Menyiapkan dashboard admin dan penyimpanan order

Website berjalan di GitHub Pages, sedangkan API dan database order berjalan di Cloudflare Workers + D1. Jangan menaruh username atau password admin di `config.js` atau file publik.

## 1. Buat database D1 dan deploy API

Di komputer yang sudah memiliki Node.js/npm:

```powershell
npm install
npx wrangler login
npm run db:create
```

Salin `database_id` dari hasil perintah, lalu ganti nilai `database_id` di `wrangler.toml`. Jalankan migrasi dan deploy:

```powershell
npm run db:migrate
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npm run deploy:api
```

Masukkan username dan password admin saat diminta oleh perintah `secret put`. Gunakan password unik yang kuat. Jangan commit `.dev.vars` atau membagikan secret.

## 2. Hubungkan website ke API dan checkout Scalev

Setelah deploy, Wrangler menampilkan URL Worker, misalnya `https://my-wish-project-api.<akun>.workers.dev`. Isi URL tersebut sebagai `apiBaseUrl` di `config.js`:

```js
window.APP_CONFIG = {
  apiBaseUrl: "https://my-wish-project-api.<akun>.workers.dev"
};
```

Website menggunakan checkout produk Scalev berikut:

```text
https://my-wish-project.myscalev.com/p/ebook-wish-come-true
```

Pastikan harga dan metode pembayaran produk di Scalev sesuai. Form website mencatat order lokal, lalu mengarahkan pelanggan ke halaman checkout Scalev. Perubahan file frontend dan Worker di branch `main` akan diterbitkan melalui GitHub Pages dan Cloudflare Workers.

## 3. Buka dashboard

Dashboard tersedia di `https://tampanwoh.github.io/my-wish-project/admin.html`. Login dengan username dan password yang disimpan sebagai Cloudflare Worker secrets.

Form website menyimpan order baru dengan status `pending`. Admin dapat melihat data pelanggan dan mengubah status menjadi `paid` atau `cancelled`. Jangan kumpulkan atau simpan data kartu pembayaran di dashboard.

## Catatan

- D1 menyimpan nama, nomor WhatsApp, email, metode pembayaran, jumlah, status, dan waktu order.
- API hanya menerima permintaan browser dari `https://tampanwoh.github.io`.
- Checkout Scalev menangani pilihan metode pembayaran dan proses pembayaran. Status order lokal di dashboard tetap perlu diperbarui manual setelah pembayaran diverifikasi di Scalev.
